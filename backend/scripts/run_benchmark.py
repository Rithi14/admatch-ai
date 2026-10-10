"""Reproducible 60-pair AdMatch AI benchmark runner."""

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.dataset_loader import load_dataset
from app.services.auditor import run_audit


REPORT_DIR = ROOT / "reports"
CSV_OUT = REPORT_DIR / "benchmark_results.csv"
JSON_OUT = REPORT_DIR / "benchmark_results.json"
REVIEW_OUT = REPORT_DIR / "ground_truth_review.csv"
TEMPLATE_OUT = REPORT_DIR / "ground_truth_template.csv"
REVIEW_COLUMNS = ["pair_id", "expected_mismatch", "review_notes", "reviewer"]


def get_score(audit):
    """Find the overall numeric match score without assuming one schema."""
    for key in ("matchScore", "match_score", "overallScore", "overall_score"):
        value = audit.get(key)
        if isinstance(value, (int, float)):
            return value

    direct_score = audit.get("score")
    if isinstance(direct_score, (int, float)):
        return direct_score

    for key in ("score", "scores", "scoreBreakdown", "score_breakdown"):
        value = audit.get(key)
        if isinstance(value, dict):
            for subkey in ("overall", "overallScore", "match", "matchScore"):
                score = value.get(subkey)
                if isinstance(score, (int, float)):
                    return score
    return None


def _ensure_ground_truth_files(records):
    """Keep human-entered review values while ensuring each dataset pair has a stable row."""
    existing_rows = []
    if REVIEW_OUT.exists():
        with REVIEW_OUT.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            existing_rows = list(reader) if reader.fieldnames else []

    existing_by_id = {}
    for row in existing_rows:
        pair_id = (row.get("pair_id") or "").strip()
        if not pair_id or pair_id in existing_by_id:
            continue
        existing_by_id[pair_id] = row

    dataset_ids = []
    for row in records:
        pair_id = (row.get("pair_id") or "").strip()
        if pair_id:
            dataset_ids.append(pair_id)

    review_rows = []
    for pair_id in dataset_ids:
        source_row = existing_by_id.get(pair_id, {})
        review_rows.append({
            "pair_id": pair_id,
            "expected_mismatch": (source_row.get("expected_mismatch") or "").strip(),
            "review_notes": (source_row.get("review_notes") or "").strip(),
            "reviewer": (source_row.get("reviewer") or "").strip(),
        })

    for pair_id, source_row in existing_by_id.items():
        if pair_id in dataset_ids:
            continue
        review_rows.append({
            "pair_id": pair_id,
            "expected_mismatch": (source_row.get("expected_mismatch") or "").strip(),
            "review_notes": (source_row.get("review_notes") or "").strip(),
            "reviewer": (source_row.get("reviewer") or "").strip(),
        })

    for path in (REVIEW_OUT, TEMPLATE_OUT):
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=REVIEW_COLUMNS)
            writer.writeheader()
            for row in review_rows:
                writer.writerow({
                    "pair_id": row.get("pair_id", ""),
                    "expected_mismatch": row.get("expected_mismatch", ""),
                    "review_notes": row.get("review_notes", ""),
                    "reviewer": row.get("reviewer", ""),
                })

    return review_rows


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    records = load_dataset()

    if not records:
        raise SystemExit("ERROR: No dataset records loaded.")

    review_rows = _ensure_ground_truth_files(records)
    results = []
    failures = []

    for index, row in enumerate(records, start=1):
        pair_id = row.get("pair_id", f"PAIR_{index:02d}")
        snapshot = Path(row["_snapshot_path"])

        try:
            html = snapshot.read_text(encoding="utf-8", errors="replace")
            # Keep each ad headline as a separate claim candidate.
            headline = "\n".join(
                (row.get(f"headline_{i}") or "").strip()
                for i in range(1, 4)
                if (row.get(f"headline_{i}") or "").strip()
            ).strip()
            body = " ".join(
                (row.get(f"description_{i}") or "").strip()
                for i in range(1, 3)
            ).strip()

            # Use a lightweight payload object; no database or network call.
            payload = SimpleNamespace(
                headline=headline,
                body=body,
                cta="",
                url=row.get("final_url", ""),
                audience="General audience",
                goal="Message match evaluation",
                industry=row.get("vertical", ""),
            )
            audit = run_audit(
                payload=payload,
                page_html=html,
                source="benchmark_snapshot",
                dataset_match=None,
            )

            evidence = audit.get("evidence", [])
            if not isinstance(evidence, list):
                evidence = []

            result = {
                "pair_id": pair_id,
                "advertiser": row.get("advertiser", ""),
                "vertical": row.get("vertical", ""),
                "snapshot_file": row.get("snapshot_file", ""),
                "status": "success",
                "match_score": get_score(audit),
                "classification": audit.get("classification", ""),
                "claim_count": len(evidence),
                "found_count": sum(
                    item.get("verified") == "found" for item in evidence
                ),
                "partial_count": sum(
                    item.get("verified") == "partial" for item in evidence
                ),
                "not_found_count": sum(
                    item.get("verified") == "not_found" for item in evidence
                ),
                "findings": evidence,
                "audit": audit,
            }
            results.append(result)
            print(
                f"[{index:02}/{len(records)}] {pair_id}: "
                f"{len(evidence)} claims audited"
            )

        except Exception as exc:
            failures.append({
                "pair_id": pair_id,
                "error": f"{type(exc).__name__}: {exc}",
            })
            results.append({
                "pair_id": pair_id,
                "advertiser": row.get("advertiser", ""),
                "vertical": row.get("vertical", ""),
                "snapshot_file": row.get("snapshot_file", ""),
                "status": "failed",
                "error": f"{type(exc).__name__}: {exc}",
                "match_score": None,
                "classification": "",
                "claim_count": 0,
                "found_count": 0,
                "partial_count": 0,
                "not_found_count": 0,
                "findings": [],
            })
            print(f"[{index:02}/{len(records)}] {pair_id}: FAILED — {exc}")

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_pairs": len(records),
        "successful_pairs": sum(r["status"] == "success" for r in results),
        "failed_pairs": len(failures),
        "total_claims": sum(r["claim_count"] for r in results),
        "total_found": sum(r["found_count"] for r in results),
        "total_partial": sum(r["partial_count"] for r in results),
        "total_not_found": sum(r["not_found_count"] for r in results),
        "note": (
            "These are observed auditor outputs, not accuracy metrics. "
            "Precision, recall and F1 require independently reviewed labels."
        ),
        "failures": failures,
        "results": results,
    }

    JSON_OUT.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    columns = [
        "pair_id", "advertiser", "vertical", "snapshot_file", "status",
        "match_score", "classification", "claim_count", "found_count",
        "partial_count", "not_found_count", "error",
    ]
    with CSV_OUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for result in results:
            writer.writerow({key: result.get(key, "") for key in columns})

    print("\n===== BENCHMARK SUMMARY =====")
    print(f"Dataset pairs:    {summary['dataset_pairs']}")
    print(f"Successful pairs: {summary['successful_pairs']}")
    print(f"Failed pairs:     {summary['failed_pairs']}")
    print(f"Claims processed: {summary['total_claims']}")
    print(f"Evidence found:   {summary['total_found']}")
    print(f"Partial matches:  {summary['total_partial']}")
    print(f"Not found:        {summary['total_not_found']}")
    print(f"\nJSON report: {JSON_OUT}")
    print(f"CSV report:  {CSV_OUT}")
    print(f"Ground-truth review: {REVIEW_OUT}")
    print(f"Ground-truth template: {TEMPLATE_OUT}")

    if failures:
        raise SystemExit("Benchmark finished with failures; inspect the JSON report.")


if __name__ == "__main__":
    main()
