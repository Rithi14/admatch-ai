import unittest
from fastapi.testclient import TestClient
from app.main import app

class ApiTests(unittest.TestCase):
    def test_health_contract(self):
        client = TestClient(app)
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_dataset_status(self):
        client = TestClient(app)
        response = client.get("/api/dataset")
        self.assertEqual(response.status_code, 200)
        self.assertIn("pairs", response.json())

if __name__ == "__main__":
    unittest.main()
