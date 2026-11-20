import time
from unittest import TestCase
from apps.integrations.webhooks import (
    sign_webhook_payload,
    verify_webhook_signature,
)


class WebhookSignatureTests(TestCase):
    def setUp(self):
        self.secret = "test-webhook-secret"
        self.body = b'{"event":"lead.created"}'
        self.timestamp = str(int(time.time()))
        self.signature = sign_webhook_payload(
            self.secret, self.timestamp, self.body
        )

    def test_valid_signature_is_accepted(self):
        valid, error = verify_webhook_signature(
            self.secret, self.timestamp, self.signature, self.body
        )
        self.assertTrue(valid)
        self.assertEqual(error, "")

    def test_tampered_payload_is_rejected(self):
        valid, error = verify_webhook_signature(
            self.secret, self.timestamp, self.signature,
            b'{"event":"lead.deleted"}'
        )
        self.assertFalse(valid)
        self.assertIn("Invalid", error)

    def test_wrong_secret_is_rejected(self):
        valid, error = verify_webhook_signature(
            "wrong-secret", self.timestamp, self.signature, self.body
        )
        self.assertFalse(valid)

    def test_old_timestamp_is_rejected(self):
        old_timestamp = str(int(time.time()) - 600)
        old_signature = sign_webhook_payload(
            self.secret, old_timestamp, self.body
        )
        valid, error = verify_webhook_signature(
            self.secret, old_timestamp, old_signature, self.body
        )
        self.assertFalse(valid)
        self.assertIn("replay window", error)

    def test_missing_headers_are_rejected(self):
        valid, error = verify_webhook_signature(
            self.secret, "", "", self.body
        )
        self.assertFalse(valid)
        self.assertIn("Missing", error)
