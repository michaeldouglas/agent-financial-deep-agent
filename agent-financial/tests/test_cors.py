import unittest

from fastapi.testclient import TestClient

from app import app


class CorsPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_local_frontend_origin_is_allowed(self) -> None:
        response = self.client.options(
            "/chat",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "http://localhost:3000",
        )
        self.assertEqual(
            response.headers.get("access-control-allow-credentials"), "true"
        )

    def test_untrusted_origin_is_rejected(self) -> None:
        response = self.client.options(
            "/chat",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
