"""Human-review preparation utilities for the benchmark ground-truth workflow."""
from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.dataset_loader import load_dataset

ROOT = Path(__file__).resolve().parents[1]
REVIEW_PATH = ROOT / "reports" / "ground_truth_review.csv"
WORKSHEET_PATH = ROOT / "reports" / "ground_truth_review_worksheet.csv"
GUIDE_PATH = ROOT / "docs" / "ground_truth_review_guide.md"
VALID_LABELS = {"true", "false", "uncertain"}
REQUIRED_REVIEW_COLUMNS = ["pair_id", "expected_mismatch", "review_notes", "reviewer"]


def normalize_label(value) -> str:
    if value is None:
        return ""
    normalized = str(value).strip().lower()
    aliases = {
        "reviewed_true": "true",
        "reviewed_false": "false",
        "reviewed_uncertain": "uncertain",
        "yes": "true",
        "y": "true",
        "no": "false",
        "n": "false",
        "1": "true",
        "0": "false",
    }
    return aliases.get(normalized, normalized)


def _effective_label(row: dict) -> str:
    if row.get("expected_mismatch") not in (None, ""):
        return normalize_label(row.get("expected_mismatch"))
    return normalize_label(row.get("review_status"))


def _read_review_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            return []
        rows = []
        for row in reader:
            if row is None:
                continue
            label_value = (row.get("expected_mismatch") or "").strip() or (row.get("review_status") or "").strip()
            rows.append({
                "pair_id": (row.get("pair_id") or "").strip(),
                "expected_mismatch": label_value,
                "review_status": (row.get("review_status") or "").strip(),
                "review_notes": (row.get("review_notes") or "").strip(),
                "reviewer": (row.get("reviewer") or "").strip(),
            })
        return rows


def _ensure_review_rows(records: Iterable[dict]) -> list[dict]:
    dataset_ids = []
    for row in records:
        pair_id = (row.get("pair_id") or "").strip()
        if pair_id:
            dataset_ids.append(pair_id)

    existing_rows = _read_review_rows(REVIEW_PATH)
    existing_by_id = {}
    for entry in existing_rows:
        pair_id = (entry.get("pair_id") or "").strip()
        if not pair_id or pair_id in existing_by_id:
            continue
        existing_by_id[pair_id] = entry

    review_rows = []
    seen: set[str] = set()
    for pair_id in dataset_ids:
        source_row = existing_by_id.get(pair_id, {})
        label_value = (source_row.get("expected_mismatch") or "").strip() or (source_row.get("review_status") or "").strip()
        review_rows.append({
            "pair_id": pair_id,
            "expected_mismatch": label_value,
            "review_notes": (source_row.get("review_notes") or "").strip(),
            "reviewer": (source_row.get("reviewer") or "").strip(),
        })
        seen.add(pair_id)

    for pair_id, source_row in existing_by_id.items():
        if pair_id in seen:
            continue
        label_value = (source_row.get("expected_mismatch") or "").strip() or (source_row.get("review_status") or "").strip()
        review_rows.append({
            "pair_id": pair_id,
            "expected_mismatch": label_value,
            "review_notes": (source_row.get("review_notes") or "").strip(),
            "reviewer": (source_row.get("reviewer") or "").strip(),
        })

    if REVIEW_PATH.parent.exists() is False:
        REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    with REVIEW_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=REQUIRED_REVIEW_COLUMNS)
        writer.writeheader()
        for row in review_rows:
            writer.writerow({
                "pair_id": row.get("pair_id", ""),
                "expected_mismatch": row.get("expected_mismatch", ""),
                "review_notes": row.get("review_notes", ""),
                "reviewer": row.get("reviewer", ""),
            })

    return review_rows


def validate_review_rows(review_rows: list[dict], valid_pair_ids: set[str]) -> dict:
    warnings: list[str] = []
    invalid_labels: list[dict] = []
    unknown_pair_ids: list[str] = []
    seen: set[str] = set()
    counts = {}

    for entry in review_rows:
        pair_id = (entry.get("pair_id") or "").strip()
        if not pair_id:
            warnings.append("A review row is missing a pair_id.")
            continue
        counts[pair_id] = counts.get(pair_id, 0) + 1
        if pair_id in seen:
            continue
        seen.add(pair_id)

        label = _effective_label(entry)
        if label and label not in VALID_LABELS:
            invalid_labels.append({"pair_id": pair_id, "value": entry.get("expected_mismatch") or entry.get("review_status")})
            warnings.append(f"Pair {pair_id} has an invalid label: {entry.get('expected_mismatch') or entry.get('review_status')!r}.")
        if label and not (entry.get("reviewer") or "").strip():
            warnings.append(f"Pair {pair_id} has a review label but is missing a reviewer name.")
        if pair_id not in valid_pair_ids:
            unknown_pair_ids.append(pair_id)
            warnings.append(f"Pair {pair_id} is not present in the dataset and should be reviewed as an unknown mapping.")

    duplicate_pair_ids = sorted(pair_id for pair_id, count in counts.items() if count > 1)
    for pair_id in duplicate_pair_ids:
        warnings.append(f"Pair {pair_id} appears more than once in the review sheet.")

    return {
        "warnings": warnings,
        "invalid_labels": invalid_labels,
        "unknown_pair_ids": sorted(unknown_pair_ids),
        "duplicate_pair_ids": duplicate_pair_ids,
    }


def build_review_worksheet_records(records: list[dict], review_rows: list[dict]) -> tuple[list[dict], dict]:
    review_by_id = {str((row.get("pair_id") or "").strip()): row for row in review_rows if (row.get("pair_id") or "").strip()}
    valid_pair_ids = {str(row.get("pair_id") or "").strip() for row in records if (row.get("pair_id") or "").strip()}
    validation = validate_review_rows(review_rows, valid_pair_ids)

    worksheet_rows = []
    for row in records:
        pair_id = str((row.get("pair_id") or "").strip())
        source_row = review_by_id.get(pair_id, {})
        label = _effective_label(source_row)
        review_status = "unreviewed"
        if label == "true":
            review_status = "reviewed_true"
        elif label == "false":
            review_status = "reviewed_false"
        elif label == "uncertain":
            review_status = "uncertain"

        ad_copy_parts = []
        for index in range(1, 4):
            headline = (row.get(f"headline_{index}") or "").strip()
            if headline:
                ad_copy_parts.append(headline)
        for index in range(1, 3):
            description = (row.get(f"description_{index}") or "").strip()
            if description:
                ad_copy_parts.append(description)
        ad_copy = " | ".join(part for part in ad_copy_parts if part)

        page_text = str((row.get("_page") or {}).get("text", "")).strip()
        page_excerpt = " ".join(page_text.split())
        if len(page_excerpt) > 1200:
            page_excerpt = page_excerpt[:1200].rstrip() + "..."

        worksheet_rows.append({
            "pair_id": pair_id,
            "advertiser": row.get("advertiser", ""),
            "vertical": row.get("vertical", ""),
            "final_url": row.get("final_url", ""),
            "snapshot_file": row.get("snapshot_file", ""),
            "review_status": review_status,
            "expected_mismatch": (source_row.get("expected_mismatch") or source_row.get("review_status") or "").strip(),
            "reviewer": source_row.get("reviewer", ""),
            "review_notes": source_row.get("review_notes", ""),
            "ad_copy": ad_copy,
            "landing_page_excerpt": page_excerpt,
        })

    return worksheet_rows, validation


def generate_review_worksheet(path: Path | None = None) -> dict:
    records = load_dataset()
    review_rows = _ensure_review_rows(records)
    worksheet_rows, validation = build_review_worksheet_records(records, review_rows)

    output_path = path or WORKSHEET_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        fieldnames = [
            "pair_id",
            "advertiser",
            "vertical",
            "final_url",
            "snapshot_file",
            "review_status",
            "expected_mismatch",
            "reviewer",
            "review_notes",
            "ad_copy",
            "landing_page_excerpt",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in worksheet_rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})

    guide_text = """# Ground-Truth Review Guide

Use this sheet to make a human decision for each benchmark pair. Do not infer labels from the AI prediction, benchmark score, or recommendations. Only a human reviewer can decide the final label.

## Label definitions

- `true`: a human reviewer confirms at least one material mismatch between the ad and the landing page.
- `false`: a human reviewer confirms there is no material mismatch.
- `uncertain`: the page or evidence is incomplete or ambiguous, so a reliable decision cannot be made.
- blank: the pair has not been reviewed yet.

## What counts as a material mismatch?

Label `true` when the ad makes a claim that is clearly unsupported or contradicted by the landing page, such as:

- promises of approval, funding, rates, or eligibility not shown on the page
- contradictory offers, deadlines, or guarantees
- price, fee, or payment terms not supported by the page copy
- missing material eligibility or disclosure information when the ad implies it is available

Label `false` when the landing page supports the claim or does not materially contradict the ad.

Label `uncertain` when the snapshot is incomplete, missing the relevant section, or the claim cannot be verified reliably from the available evidence.

## Review workflow

1. Open the worksheet CSV for the current pair.
2. Read the ad copy and the landing-page excerpt together.
3. Check for direct contradictions or missing material offers.
4. If the page is incomplete or the evidence is unclear, use `uncertain`.
5. Save the final label in `expected_mismatch` and add your name in `reviewer`.
6. Add notes in `review_notes` when the evidence is borderline or needs context.

Do not automatically convert AI suggestions into ground truth. Keep blank values blank until a real reviewer decides.
"""
    GUIDE_PATH.parent.mkdir(parents=True, exist_ok=True)
    GUIDE_PATH.write_text(guide_text, encoding="utf-8")

    return {
        "worksheet_path": str(output_path),
        "guide_path": str(GUIDE_PATH),
        "total_pairs": len(records),
        "review_rows": len(review_rows),
        "warnings": validation["warnings"],
        "invalid_labels": validation["invalid_labels"],
        "unknown_pair_ids": validation["unknown_pair_ids"],
        "duplicate_pair_ids": validation["duplicate_pair_ids"],
    }


def main() -> None:
    summary = generate_review_worksheet()
    print(f"Worksheet: {summary['worksheet_path']}")
    print(f"Guide: {summary['guide_path']}")
    print(f"Pairs: {summary['total_pairs']}")
    if summary["warnings"]:
        print("Warnings:")
        for item in summary["warnings"]:
            print(f"- {item}")
    else:
        print("No worksheet warnings detected.")


if __name__ == "__main__":
    main()
