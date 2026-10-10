import unittest
from app.services.scoring import score_audit

class ScoringTests(unittest.TestCase):
    def test_score_is_bounded(self):
        evidence = [
            {"verified": "found", "severity": "low"},
            {"verified": "not_found", "severity": "high"},
        ]
        score, dims = score_audit(evidence, "A sufficiently long landing page body", "Landing page")
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)
        self.assertTrue(dims)

    def test_missing_content_is_unscored_dimensions(self):
        score, dims = score_audit([], "", "Test")
        self.assertEqual(score, 0)
        self.assertIsNone(dims[0]["score"])

if __name__ == "__main__":
    unittest.main()
