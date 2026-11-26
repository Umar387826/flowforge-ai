from django.test import SimpleTestCase

from apps.documents.tasks import normalize_and_chunk_text


class DocumentChunkingTests(SimpleTestCase):
    def test_empty_text_returns_no_chunks(self):
        self.assertEqual(normalize_and_chunk_text("   \n\n  "), [])

    def test_text_is_normalized_and_chunked(self):
        text = "  First   line.\r\n\r\n\r\nSecond\tline.  "
        chunks = normalize_and_chunk_text(text, chunk_size=30, chunk_overlap=5)
        self.assertTrue(chunks)
        combined = " ".join(chunks)
        self.assertIn("First line.", combined)
        self.assertIn("Second line.", combined)
        self.assertTrue(all(chunk.strip() for chunk in chunks))

    def test_long_text_produces_multiple_bounded_chunks(self):
        text = " ".join(["document"] * 100)
        chunks = normalize_and_chunk_text(text, chunk_size=80, chunk_overlap=10)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk) <= 80 for chunk in chunks))

