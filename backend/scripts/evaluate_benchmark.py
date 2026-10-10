"""Calculate pair-level mismatch metrics against independently reviewed labels."""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABELS = ROOT / "reports" / "ground_truth_template.csv"
RESULTS = ROOT / "reports" / "benchmark_results.json"
OUTPUT = ROOT / "reports" / "benchmark_metrics.json"


def main():
    if not LABELS.exists() or not RESULTS.exists():
        raise SystemExit("Run the benchmark first to create its reports.")

    with LABELS.open(encoding="utf-8", newline="") as f:
        labels = list(csv.DictReader(f))

    empty = [
        row.get("pair_id", "")
        for row in labels
        if (row.get("expected_mismatch") or "").strip().lower()
        not in {"true", "false", "yes", "no", "1", "0"}
    ]
    if empty:
        print(f"Ground-truth labels still missing/uncertain: {len(empty)}")
        print("Review and label these pairs before calculating metrics.")
        print("Examples:", ", ".join(empty[:10]))
        raise SystemExit(2)

    with RESULTS.open(encoding="utf-8") as f:
        report = json.load(f)

    by_id = {r["pair_id"]: r for r in report.get("results", [])}
    tp = fp = fn = tn = 0
    skipped = []

    for row in labels:
        pair_id = row["pair_id"]
        result = by_id.get(pair_id)
        if not result or result.get("status") != "success":
            skipped.append(pair_id)
            continue

        actual = row["expected_mismatch"].strip().lower() in {"true", "yes", "1"}
        # Pair-level operational proxy: at least one claim not found.
        predicted = result.get("not_found_count", 0) > 0

        if predicted and actual:
            tp += 1
        elif predicted and not actual:
            fp += 1
        elif not predicted and actual:
            fn += 1
        else:
            tn += 1

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    metrics = {
        "evaluation_unit": "ad_landing_page_pair",
        "prediction_rule": "At least one not_found claim means predicted mismatch",
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "skipped_pairs": skipped,
        "caveat": "Pair-level proxy metric; interpret only after independent label review.",
    }
    OUTPUT.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    print("Saved:", OUTPUT)


if __name__ == "__main__":
    main()
