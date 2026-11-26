
import json
import urllib.error
import urllib.request
import uuid

from django.conf import settings

from apps.agents.services import (
    BaseLLMProvider,
    LLMProviderError,
    LLMResponse,
)


class OllamaLLMProvider(BaseLLMProvider):
    """Local Ollama chat provider."""

    def __init__(self):
        self.base_url = getattr(
            settings,
            "OLLAMA_BASE_URL",
            "http://host.docker.internal:11434",
        ).rstrip("/")

        self.default_model = getattr(
            settings,
            "OLLAMA_CHAT_MODEL",
            "qwen2.5:3b",
        )

    @staticmethod
    def _convert_tools(tools):
        converted = []

        for tool in tools or []:
            schema = tool.get("input_schema") or tool.get("parameters") or {
                "type": "object",
                "properties": {},
            }

            converted.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": schema,
                },
            })

        return converted

    def _request(self, payload, stream=False):
        request = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            return urllib.request.urlopen(request, timeout=180)

        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise LLMProviderError(
                f"Ollama HTTP error {exc.code}: {detail}"
            ) from exc

        except (urllib.error.URLError, TimeoutError) as exc:
            raise LLMProviderError(
                f"Cannot connect to Ollama: {exc}"
            ) from exc

    def generate(
        self,
        system_prompt,
        messages,
        model=None,
        temperature=0.2,
        max_tokens=1024,
        tools=None,
    ):
        chat_messages = []

        if system_prompt:
            chat_messages.append({
                "role": "system",
                "content": system_prompt,
            })

        for message in messages:
            role = message.get("role")

            if role not in ("user", "assistant"):
                continue

            chat_messages.append({
                "role": role,
                "content": str(message.get("content", "")),
            })

        payload = {
            "model": model or self.default_model,
            "messages": chat_messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        converted_tools = self._convert_tools(tools)

        if converted_tools:
            payload["tools"] = converted_tools

        try:
            with self._request(payload) as response:
                result = json.loads(response.read().decode("utf-8"))

            message = result.get("message") or {}
            tool_calls = []

            for call in message.get("tool_calls") or []:
                function = call.get("function") or {}

                arguments = function.get("arguments") or {}

                if isinstance(arguments, str):
                    arguments = json.loads(arguments)

                tool_calls.append({
                    "id": f"ollama_{uuid.uuid4().hex}",
                    "name": function.get("name", ""),
                    "input": arguments,
                })

            return LLMResponse(
                content=message.get("content", ""),
                input_tokens=result.get("prompt_eval_count", 0),
                output_tokens=result.get("eval_count", 0),
                tool_calls=tool_calls,
            )

        except LLMProviderError:
            raise

        except Exception as exc:
            raise LLMProviderError(
                f"Ollama generation failed: {exc}"
            ) from exc

    def stream(
        self,
        system_prompt,
        messages,
        model=None,
        temperature=0.2,
        max_tokens=1024,
        tools=None,
    ):
        chat_messages = []

        if system_prompt:
            chat_messages.append({
                "role": "system",
                "content": system_prompt,
            })

        for message in messages:
            if message.get("role") in ("user", "assistant"):
                chat_messages.append({
                    "role": message["role"],
                    "content": str(message.get("content", "")),
                })

        payload = {
            "model": model or self.default_model,
            "messages": chat_messages,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        converted_tools = self._convert_tools(tools)

        if converted_tools:
            payload["tools"] = converted_tools

        try:
            with self._request(payload, stream=True) as response:
                for line in response:
                    if not line.strip():
                        continue

                    item = json.loads(line.decode("utf-8"))
                    content = (item.get("message") or {}).get("content", "")

                    if content:
                        yield content

                    if item.get("done"):
                        break

        except LLMProviderError:
            raise

        except Exception as exc:
            raise LLMProviderError(
                f"Ollama streaming failed: {exc}"
            ) from exc
