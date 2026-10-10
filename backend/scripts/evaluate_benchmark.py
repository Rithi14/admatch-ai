"""Evaluate benchmark predictions against human-reviewed ground truth."""
from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS_PATH = ROOT / "reports" / "benchmark_results.json"
REVIEW_PATH = ROOT / "reports" / "ground_truth_review.csv"
METRICS_JSON_PATH = ROOT / "reports" / "benchmark_metrics.json"
METRICS_CSV_PATH = ROOT / "reports" / "benchmark_metrics.csv"

REQUIRED_REVIEW_COLUMNS = ["pair_id", "expected_mismatch", "review_notes", "reviewer"]
VALID_TRUE = {"true", "1", "yes"}
VALID_FALSE = {"false", "0", "no"}
VALID_LABELS = {"true", "false", "uncertain"}
PREDICTION_RULE = (
    "Predict a mismatch when not_found_count > 0 for a benchmark pair. "
    "This is a heuristic proxy based only on benchmark output and can flag a valid offer "
    "if the snapshot omits a claim or the page is incomplete."
)


def _safe_divide(numerator: float | int | None, denominator: float | int | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return round(float(numerator) / float(denominator), 4)


def _normalize_label(value):
    if value is None:
        return ""
    return str(value).strip().lower()


def _ensure_review_rows(result_pair_ids: list[str] | set[str] | None = None) -> list[dict]:
    result_pair_ids = set(result_pair_ids or [])
    rows: list[dict] = []

    if REVIEW_PATH.exists():
        with REVIEW_PATH.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames is None:
                fieldnames = REQUIRED_REVIEW_COLUMNS
            else:
                fieldnames = list(reader.fieldnames)
                for required in REQUIRED_REVIEW_COLUMNS:
                    if required not in fieldnames:
                        fieldnames.append(required)
            for row in reader:
                if not row:
                    continue
                normalized = {field: (row.get(field) or "") for field in fieldnames}
                pair_id = (normalized.get("pair_id") or "").strip()
                if not pair_id:
                    normalized["pair_id"] = ""
                    rows.append(normalized)
                    continue
                rows.append({col: (normalized.get(col) or "") for col in REQUIRED_REVIEW_COLUMNS})
    else:
        rows = []

    existing_ids = {str((row.get("pair_id") or "")).strip() for row in rows if (row.get("pair_id") or "").strip()}
    for pair_id in sorted(result_pair_ids - existing_ids):
        rows.append({"pair_id": pair_id, "expected_mismatch": "", "review_notes": "", "reviewer": ""})

    return rows


def _validate_review_rows(review_rows: list[dict], result_pair_ids: set[str]) -> dict:
    warnings: list[dict] = []
    pair_counts = Counter()
    review_pair_ids: set[str] = set()

    for row in review_rows:
        pair_id = (row.get("pair_id") or "").strip()
        if not pair_id:
            warnings.append({"type": "missing_pair_id", "message": "A review row is missing a pair_id."})
            continue
        pair_counts[pair_id] += 1
        review_pair_ids.add(pair_id)

        label = _normalize_label(row.get("expected_mismatch"))
        if label and label not in VALID_LABELS:
            warnings.append({
                "type": "invalid_label",
                "pair_id": pair_id,
                "value": row.get("expected_mismatch"),
                "message": "Label is not in the allowed set: true, false, uncertain, or blank.",
            })

    duplicate_pair_ids = sorted(pair_id for pair_id, count in pair_counts.items() if count > 1)
    for pair_id in duplicate_pair_ids:
        warnings.append({
            "type": "duplicate_pair_id",
            "pair_id": pair_id,
            "message": "Duplicate pair_id found in ground_truth_review.csv; preserving the first non-empty value.",
        })

    missing_in_review = sorted(result_pair_ids - review_pair_ids)
    for pair_id in missing_in_review:
        warnings.append({
            "type": "missing_pair_id_in_review",
            "pair_id": pair_id,
            "message": "Benchmark result pair_id is missing from the review sheet.",
        })

    unmatched_in_results = sorted(review_pair_ids - result_pair_ids)
    for pair_id in unmatched_in_results:
        warnings.append({
            "type": "unmatched_pair_id",
            "pair_id": pair_id,
            "message": "Review sheet pair_id does not exist in the benchmark results.",
        })

    return {
        "warnings": warnings,
        "pair_counts": pair_counts,
        "review_pair_ids": review_pair_ids,
        "missing_in_review": missing_in_review,
        "unmatched_in_results": unmatched_in_results,
        "duplicate_pair_ids": duplicate_pair_ids,
    }


def _deduplicate_review_rows(review_rows: list[dict]) -> list[dict]:
    deduped: list[dict] = []
    seen: set[str] = set()
    for row in review_rows:
        pair_id = (row.get("pair_id") or "").strip()
        if not pair_id:
            deduped.append(row)
            continue
        if pair_id in seen:
            continue
        deduped.append({
            "pair_id": pair_id,
            "expected_mismatch": row.get("expected_mismatch", "") or "",
            "review_notes": row.get("review_notes", "") or "",
            "reviewer": row.get("reviewer", "") or "",
        })
        seen.add(pair_id)
    return deduped


def evaluate_pair_predictions(result_rows: list[dict], review_rows: list[dict]) -> dict:
    result_pairs = []
    for row in result_rows:
        if not isinstance(row, dict):
            continue
        pair_id = str(row.get("pair_id") or "").strip()
        if not pair_id:
            continue
        result_pairs.append({"pair_id": pair_id, "status": row.get("status"), "not_found_count": row.get("not_found_count", 0)})
    by_pair = {entry["pair_id"]: entry for entry in result_pairs}
    result_pair_ids = set(by_pair)

    validation = _validate_review_rows(review_rows, result_pair_ids)
    deduped_review_rows = _deduplicate_review_rows(review_rows)
    warnings = validation["warnings"]

    tp = fp = fn = tn = 0
    valid_reviewed = 0
    unreviewed = 0
    uncertain = 0
    reviewed_pairs = 0
    invalid_labels = []

    for row in deduped_review_rows:
        pair_id = (row.get("pair_id") or "").strip()
        label = _normalize_label(row.get("expected_mismatch"))

        if not pair_id:
            continue

        if label == "":
            unreviewed += 1
            continue

        if label == "uncertain":
            uncertain += 1
            continue

        if label not in {"true", "false"}:
            invalid_labels.append({"pair_id": pair_id, "value": row.get("expected_mismatch")})
            continue

        result = by_pair.get(pair_id)
        if not result or result.get("status") != "success":
            warnings.append({
                "type": "skipped_result",
                "pair_id": pair_id,
                "message": "Review label exists but the benchmark result is missing or failed.",
            })
            continue

        reviewed_pairs += 1
        valid_reviewed += 1
        actual = label == "true"
        predicted = int((result.get("not_found_count") or 0) > 0)

        if predicted and actual:
            tp += 1
        elif predicted and not actual:
            fp += 1
        elif not predicted and actual:
            fn += 1
        elif not predicted and not actual:
            tn += 1

    total_valid = tp + fp + fn + tn
    precision = _safe_divide(tp, tp + fp)
    recall = _safe_divide(tp, tp + fn)
    f1 = None
    if precision is not None and recall is not None:
        if precision + recall == 0:
            f1 = None
        else:
            f1 = round((2 * precision * recall) / (precision + recall), 4)
    accuracy = _safe_divide(tp + tn, total_valid)

    status = "awaiting_human_review"
    if reviewed_pairs > 0:
        status = "partial_review" if reviewed_pairs < len(result_pairs) else "ready"

    metrics = {
        "evaluation_unit": "ad_landing_page_pair",
        "prediction_rule": PREDICTION_RULE,
        "status": status,
        "confusion_matrix": {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
        },
        "metrics": {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "accuracy": accuracy,
            "reviewed_pairs": reviewed_pairs,
            "unreviewed_pairs": unreviewed,
            "uncertain_pairs": uncertain,
            "total_valid_reviewed_pairs": total_valid,
        },
        "review_summary": {
            "reviewed_pairs": reviewed_pairs,
            "unreviewed_pairs": unreviewed,
            "uncertain_pairs": uncertain,
            "valid_reviewed_pairs": total_valid,
            "invalid_label_count": len(invalid_labels),
            "missing_in_review": validation["missing_in_review"],
            "unmatched_in_results": validation["unmatched_in_results"],
            "duplicate_pair_ids": validation["duplicate_pair_ids"],
        },
        "validation_warnings": warnings,
        "invalid_labels": invalid_labels,
    }
    return metrics


def _load_results() -> dict:
    if not RESULTS_PATH.exists():
        raise FileNotFoundError(f"Benchmark results not found: {RESULTS_PATH}")
    with RESULTS_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_metrics_csv(report: dict) -> None:
    row = {
        "status": report.get("status", "unknown"),
        "reviewed_pairs": report["metrics"].get("reviewed_pairs"),
        "unreviewed_pairs": report["metrics"].get("unreviewed_pairs"),
        "uncertain_pairs": report["metrics"].get("uncertain_pairs"),
        "tp": report["confusion_matrix"].get("tp"),
        "fp": report["confusion_matrix"].get("fp"),
        "fn": report["confusion_matrix"].get("fn"),
        "tn": report["confusion_matrix"].get("tn"),
        "precision": report["metrics"].get("precision"),
        "recall": report["metrics"].get("recall"),
        "f1_score": report["metrics"].get("f1_score"),
        "accuracy": report["metrics"].get("accuracy"),
        "prediction_rule": PREDICTION_RULE,
    }
    with METRICS_CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(row.keys()))
        writer.writeheader()
        writer.writerow(row)


def generate_evaluation_report() -> dict:
    if not RESULTS_PATH.exists():
        raise FileNotFoundError(f"Run the benchmark first: {RESULTS_PATH}")

    report = _load_results()
    result_rows = report.get("results", [])
    review_rows = _ensure_review_rows([str(row.get("pair_id") or "").strip() for row in result_rows if str(row.get("pair_id") or "").strip()])
    metrics = evaluate_pair_predictions(result_rows, review_rows)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "benchmark_results": str(RESULTS_PATH),
        "ground_truth_review": str(REVIEW_PATH),
        "status": metrics["status"],
        "dataset_pairs": len(result_rows),
        "review_summary": metrics["review_summary"],
        "prediction_rule": PREDICTION_RULE,
        "confusion_matrix": metrics["confusion_matrix"],
        "metrics": metrics["metrics"],
        "validation_warnings": metrics["validation_warnings"],
        "caveat": "These metrics use human-reviewed true/false pairs only and are a heuristic benchmark proxy, not definitive truth.",
    }

    METRICS_JSON_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    _write_metrics_csv(output)
    return output


def main() -> None:
    try:
        report = generate_evaluation_report()
    except FileNotFoundError as exc:
        raise SystemExit(str(exc)) from exc

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"Saved metrics JSON: {METRICS_JSON_PATH}")
    print(f"Saved metrics CSV: {METRICS_CSV_PATH}")


if __name__ == "__main__":
    main()
