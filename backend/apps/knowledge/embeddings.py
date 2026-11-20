
from abc import ABC, abstractmethod
import time

from django.conf import settings
from openai import (
    OpenAI,
    APIConnectionError,
    RateLimitError,
    APITimeoutError,
)


class EmbeddingProviderError(Exception):
    """Permanent or non-retryable embedding error."""
    pass


class TransientEmbeddingProviderError(EmbeddingProviderError):
    """Temporary embedding error that Celery may retry."""
    pass


class BaseEmbeddingProvider(ABC):
    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, model: str | None = None, batch_size: int = 64):
        self.api_key = settings.OPENAI_API_KEY
        self.model = model or settings.OPENAI_EMBEDDING_MODEL
        self.batch_size = batch_size

    @staticmethod
    def _is_quota_exhausted(exc: RateLimitError) -> bool:
        code = getattr(exc, "code", None)
        body = getattr(exc, "body", None)

        if isinstance(body, dict):
            code = code or body.get("code")
            error_data = body.get("error")
            if isinstance(error_data, dict):
                code = code or error_data.get("code")

        message = str(exc).lower()

        return (
            code in {"insufficient_quota", "billing_hard_limit_reached"}
            or "insufficient_quota" in message
            or "credit_balance_exhausted" in message
            or "billing_hard_limit" in message
        )

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if not self.api_key:
            raise EmbeddingProviderError(
                "OPENAI_API_KEY is not configured."
            )

        client = OpenAI(api_key=self.api_key, timeout=30.0, max_retries=0)
        all_vectors: list[list[float]] = []

        for i in range(0, len(texts), self.batch_size):
            batch = [
                text.replace("\x00", " ").strip() or " "
                for text in texts[i:i + self.batch_size]
            ]

            last_exc = None

            for attempt in range(3):
                try:
                    response = client.embeddings.create(
                        model=self.model,
                        input=batch,
                    )

                    sorted_data = sorted(
                        response.data,
                        key=lambda item: item.index,
                    )

                    batch_vectors = [
                        item.embedding for item in sorted_data
                    ]

                    if len(batch_vectors) != len(batch):
                        raise EmbeddingProviderError(
                            "OpenAI returned an unexpected number of embeddings."
                        )

                    all_vectors.extend(batch_vectors)
                    last_exc = None
                    break

                except RateLimitError as exc:
                    if self._is_quota_exhausted(exc):
                        raise EmbeddingProviderError(
                            "OpenAI API quota is exhausted. "
                            "Check the API project's available quota."
                        ) from exc

                    last_exc = exc

                except (APIConnectionError, APITimeoutError) as exc:
                    last_exc = exc

                except EmbeddingProviderError:
                    raise

                except Exception as exc:
                    raise EmbeddingProviderError(
                        f"OpenAI embedding request failed: {exc}"
                    ) from exc

                if attempt < 2:
                    time.sleep(2 ** attempt)

            if last_exc is not None:
                raise TransientEmbeddingProviderError(
                    f"OpenAI embedding retries exhausted: {last_exc}"
                ) from last_exc

        return all_vectors


def get_embedding_provider(
    model: str | None = None,
) -> BaseEmbeddingProvider:
    return OpenAIEmbeddingProvider(model=model)


