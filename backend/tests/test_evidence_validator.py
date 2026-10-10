import unittest
from app.services.evidence_validator import find_evidence

class EvidenceTests(unittest.TestCase):
    def test_exact_quote_is_returned(self):
        text = "Apply today. Funding up to $500,000 for qualified businesses."
        result = find_evidence("Funding up to $500,000", text)
        self.assertEqual(result["verified"], "found")
        self.assertIn("$500,000", result["evidence"])

    def test_absent_claim_does_not_fabricate_quote(self):
        result = find_evidence("Guaranteed same-day approval", "We review applications in five business days.")
        self.assertEqual(result["verified"], "not_found")
        self.assertIsNone(result["evidence"])

if __name__ == "__main__":
    unittest.main()
