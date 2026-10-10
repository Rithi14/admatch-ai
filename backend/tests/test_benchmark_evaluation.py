import csv
import json
import tempfile
import unittest
from pathlib import Path

from app.services.dataset_loader import load_dataset
import scripts.evaluate_benchmark as benchmark_eval
import scripts.prepare_ground_truth_review as review_prep


class BenchmarkEvaluationTests(unittest.TestCase):
    def _result_rows(self, mapping):
        return [
            {"pair_id": pair_id, "status": "success", "not_found_count": value}
            for pair_id, value in mapping.items()
        ]

    def test_confusion_matrix_and_metrics(self):
        result_rows = self._result_rows({"P01": 2, "P02": 0, "P03": 1, "P04": 0})
        review_rows = [
            {"pair_id": "P01", "expected_mismatch": "true", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P02", "expected_mismatch": "false", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P03", "expected_mismatch": "false", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P04", "expected_mismatch": "true", "review_notes": "", "reviewer": "A"},
        ]

        metrics = benchmark_eval.evaluate_pair_predictions(result_rows, review_rows)

        self.assertEqual(metrics["confusion_matrix"], {"tp": 1, "fp": 1, "fn": 1, "tn": 1})
        self.assertEqual(metrics["metrics"]["precision"], 0.5)
        self.assertEqual(metrics["metrics"]["recall"], 0.5)
        self.assertEqual(metrics["metrics"]["f1_score"], 0.5)
        self.assertEqual(metrics["metrics"]["accuracy"], 0.5)
        self.assertEqual(metrics["metrics"]["reviewed_pairs"], 4)
        self.assertEqual(metrics["metrics"]["unreviewed_pairs"], 0)

    def test_all_positive_and_all_negative_cases(self):
        positive_results = self._result_rows({"P01": 1, "P02": 2, "P03": 3})
        positive_review = [
            {"pair_id": "P01", "expected_mismatch": "true", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P02", "expected_mismatch": "true", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P03", "expected_mismatch": "true", "review_notes": "", "reviewer": "A"},
        ]
        pos_metrics = benchmark_eval.evaluate_pair_predictions(positive_results, positive_review)
        self.assertEqual(pos_metrics["confusion_matrix"], {"tp": 3, "fp": 0, "fn": 0, "tn": 0})
        self.assertEqual(pos_metrics["metrics"]["precision"], 1.0)
        self.assertEqual(pos_metrics["metrics"]["f1_score"], 1.0)

        negative_results = self._result_rows({"P10": 0, "P11": 0, "P12": 0})
        negative_review = [
            {"pair_id": "P10", "expected_mismatch": "false", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P11", "expected_mismatch": "false", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P12", "expected_mismatch": "false", "review_notes": "", "reviewer": "A"},
        ]
        neg_metrics = benchmark_eval.evaluate_pair_predictions(negative_results, negative_review)
        self.assertEqual(neg_metrics["confusion_matrix"], {"tp": 0, "fp": 0, "fn": 0, "tn": 3})
        self.assertEqual(neg_metrics["metrics"]["accuracy"], 1.0)

    def test_zero_denominator_and_blank_uncertain_labels(self):
        result_rows = self._result_rows({"P01": 0, "P02": 1})
        review_rows = [
            {"pair_id": "P01", "expected_mismatch": "false", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P02", "expected_mismatch": "", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P03", "expected_mismatch": "uncertain", "review_notes": "", "reviewer": "A"},
        ]

        metrics = benchmark_eval.evaluate_pair_predictions(result_rows, review_rows)
        self.assertEqual(metrics["metrics"]["reviewed_pairs"], 1)
        self.assertEqual(metrics["metrics"]["unreviewed_pairs"], 1)
        self.assertEqual(metrics["metrics"]["uncertain_pairs"], 1)
        self.assertIsNone(metrics["metrics"]["precision"])
        self.assertIsNone(metrics["metrics"]["recall"])
        self.assertEqual(metrics["metrics"]["accuracy"], 1.0)

    def test_invalid_labels_and_duplicate_missing_ids(self):
        result_rows = self._result_rows({"P01": 1, "P02": 0})
        review_rows = [
            {"pair_id": "P01", "expected_mismatch": "true", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P01", "expected_mismatch": "false", "review_notes": "", "reviewer": "B"},
            {"pair_id": "P03", "expected_mismatch": "maybe", "review_notes": "", "reviewer": "C"},
            {"pair_id": "P04", "expected_mismatch": "false", "review_notes": "", "reviewer": "D"},
        ]

        metrics = benchmark_eval.evaluate_pair_predictions(result_rows, review_rows)
        self.assertIn("duplicate_pair_id", [warning["type"] for warning in metrics["validation_warnings"]])
        self.assertIn("missing_pair_id_in_review", [warning["type"] for warning in metrics["validation_warnings"]])
        self.assertIn("invalid_label", [warning["type"] for warning in metrics["validation_warnings"]])
        self.assertEqual(metrics["review_summary"]["duplicate_pair_ids"], ["P01"])

    def test_preservation_of_existing_human_review_labels(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            old_review = Path(tmpdir) / "ground_truth_review.csv"
            old_review.write_text(
                "pair_id,expected_mismatch,review_notes,reviewer\nP01,true,Reviewed by human,alice\nP02,, ,\n",
                encoding="utf-8",
            )
            original_review = benchmark_eval.REVIEW_PATH
            benchmark_eval.REVIEW_PATH = old_review
            try:
                rows = benchmark_eval._ensure_review_rows({"P01", "P02", "P03"})
                review_by_id = {row["pair_id"]: row for row in rows}
                self.assertEqual(review_by_id["P01"]["expected_mismatch"], "true")
                self.assertEqual(review_by_id["P01"]["reviewer"], "alice")
                self.assertEqual(review_by_id["P03"]["expected_mismatch"], "")
            finally:
                benchmark_eval.REVIEW_PATH = original_review

    def test_no_reviewed_labels_produces_null_metrics(self):
        result_rows = self._result_rows({"P01": 1, "P02": 0})
        review_rows = [
            {"pair_id": "P01", "expected_mismatch": "", "review_notes": "", "reviewer": ""},
            {"pair_id": "P02", "expected_mismatch": "", "review_notes": "", "reviewer": ""},
        ]
        metrics = benchmark_eval.evaluate_pair_predictions(result_rows, review_rows)
        self.assertEqual(metrics["status"], "awaiting_human_review")
        self.assertIsNone(metrics["metrics"]["precision"])
        self.assertIsNone(metrics["metrics"]["recall"])
        self.assertIsNone(metrics["metrics"]["f1_score"])

    def test_report_files_are_generated_correctly(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            results_path = tmp_path / "benchmark_results.json"
            review_path = tmp_path / "ground_truth_review.csv"
            metrics_json = tmp_path / "benchmark_metrics.json"
            metrics_csv = tmp_path / "benchmark_metrics.csv"

            results_path.write_text(
                json.dumps({
                    "results": [
                        {"pair_id": "P01", "status": "success", "not_found_count": 2},
                        {"pair_id": "P02", "status": "success", "not_found_count": 0},
                    ]
                }, ensure_ascii=False),
                encoding="utf-8",
            )
            review_path.write_text(
                "pair_id,expected_mismatch,review_notes,reviewer\nP01,true,Human label,alice\nP02,false,Human label,bob\n",
                encoding="utf-8",
            )

            original_results_path = benchmark_eval.RESULTS_PATH
            original_review_path = benchmark_eval.REVIEW_PATH
            original_metrics_json = benchmark_eval.METRICS_JSON_PATH
            original_metrics_csv = benchmark_eval.METRICS_CSV_PATH

            benchmark_eval.RESULTS_PATH = results_path
            benchmark_eval.REVIEW_PATH = review_path
            benchmark_eval.METRICS_JSON_PATH = metrics_json
            benchmark_eval.METRICS_CSV_PATH = metrics_csv
            try:
                report = benchmark_eval.generate_evaluation_report()
                self.assertEqual(report["status"], "ready")
                self.assertTrue(metrics_json.exists())
                self.assertTrue(metrics_csv.exists())
                self.assertEqual(report["confusion_matrix"]["tp"], 1)
                self.assertEqual(report["confusion_matrix"]["tn"], 1)
            finally:
                benchmark_eval.RESULTS_PATH = original_results_path
                benchmark_eval.REVIEW_PATH = original_review_path
                benchmark_eval.METRICS_JSON_PATH = original_metrics_json
                benchmark_eval.METRICS_CSV_PATH = original_metrics_csv

    def test_review_worksheet_contains_dataset_mapping_and_preserves_labels(self):
        records = load_dataset()
        review_rows = [
            {"pair_id": "P01", "expected_mismatch": "false", "review_notes": "Looks supported", "reviewer": "alice"},
            {"pair_id": "P02", "expected_mismatch": "", "review_notes": "", "reviewer": ""},
        ]

        worksheet_rows, validation = review_prep.build_review_worksheet_records(records, review_rows)
        self.assertEqual(len(worksheet_rows), len(records))
        self.assertEqual(worksheet_rows[0]["pair_id"], "P01")
        self.assertIn("Rates From 6.9% APR", worksheet_rows[0]["ad_copy"])
        self.assertIn("landing_page_excerpt", worksheet_rows[0])
        self.assertEqual(worksheet_rows[0]["review_status"], "reviewed_false")
        self.assertEqual(worksheet_rows[1]["review_status"], "unreviewed")
        self.assertEqual(validation["warnings"], [])

    def test_review_validation_rejects_invalid_label_and_unknown_pair(self):
        valid_pair_ids = {f"P{i:02d}" for i in range(1, 4)}
        review_rows = [
            {"pair_id": "P01", "expected_mismatch": "maybe", "review_notes": "bad", "reviewer": "a"},
            {"pair_id": "P03", "expected_mismatch": "true", "review_notes": "", "reviewer": ""},
            {"pair_id": "P99", "expected_mismatch": "false", "review_notes": "ghost", "reviewer": "b"},
            {"pair_id": "P01", "expected_mismatch": "false", "review_notes": "duplicate", "reviewer": "c"},
        ]

        validation = review_prep.validate_review_rows(review_rows, valid_pair_ids)
        self.assertIn("maybe", [item["value"] for item in validation["invalid_labels"]])
        self.assertIn("P99", validation["unknown_pair_ids"])
        self.assertIn("P01", validation["duplicate_pair_ids"])

    def test_review_status_alias_and_duplicate_result_ids_are_handled(self):
        result_rows = [
            {"pair_id": "P01", "status": "success", "not_found_count": 1},
            {"pair_id": "P01", "status": "success", "not_found_count": 0},
            {"pair_id": "P02", "status": "success", "not_found_count": 0},
            {"pair_id": "", "status": "success", "not_found_count": 1},
        ]
        review_rows = [
            {"pair_id": "P01", "review_status": "true", "review_notes": "", "reviewer": "A"},
            {"pair_id": "P02", "review_status": "false", "review_notes": "", "reviewer": "A"},
        ]

        metrics = benchmark_eval.evaluate_pair_predictions(result_rows, review_rows)
        self.assertEqual(metrics["confusion_matrix"]["tp"], 1)
        self.assertEqual(metrics["confusion_matrix"]["tn"], 1)
        self.assertIn("duplicate_result_pair_id", [warning["type"] for warning in metrics["validation_warnings"]])
        self.assertIn("missing_pair_id_in_results", [warning["type"] for warning in metrics["validation_warnings"]])


if __name__ == "__main__":
    unittest.main()
