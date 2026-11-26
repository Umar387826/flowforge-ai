from rest_framework.test import APITestCase
from apps.accounts.models import User

class LoginTests(APITestCase):
    def test_valid_login(self):
        User.objects.create_user(
            email="test@example.com",
            password="TestPass123!",
            full_name="Test User"
        )
        response = self.client.post("/api/v1/auth/login/", {
            "email": "test@example.com",
            "password": "TestPass123!"
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("tokens", response.data)