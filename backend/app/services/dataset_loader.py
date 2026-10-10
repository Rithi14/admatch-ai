"""Loads the supplied benchmark CSV and its local HTML snapshots."""
import csv
from functools import lru_cache
from pathlib import Path
from app.core.config import DATASET_DIR
from app.services.content_extractor import extract_page_content

@lru_cache(maxsize=1)
def load_dataset() -> list[dict]:
    csv_path = DATASET_DIR / "ads.csv"
    if not csv_path.exists():
        return []
    records = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            snapshot_rel = (row.get("snapshot_file") or "").replace("\\", "/")
            snapshot_path = (DATASET_DIR / snapshot_rel).resolve()
            # Prevent CSV-controlled paths from escaping the dataset folder.
            if DATASET_DIR.resolve() not in snapshot_path.parents:
                continue
            if not snapshot_path.is_file() or snapshot_path.suffix.lower() != ".html":
                continue
            html = snapshot_path.read_text(encoding="utf-8", errors="replace")
            page = extract_page_content(html)
            records.append({**row, "_snapshot_path": str(snapshot_path), "_page": page})
    return records

def get_dataset_stats() -> dict:
    rows = load_dataset()
    return {"available": bool(rows), "pairs": len(rows), "snapshot_count": sum(bool(row.get("_page", {}).get("text")) for row in rows), "dataset_dir": str(DATASET_DIR)}

def choose_dataset_page(url: str, headline: str, body: str = "") -> dict | None:
    """Only match exact dataset host/path; rank same-URL ad variants by ad-copy similarity."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if not (parsed.hostname or "").lower().endswith(".example"):
        return None
    candidates = []
    ad_words = set((headline + " " + body).lower().split())
    for row in load_dataset():
        rp = urlparse(row.get("final_url", ""))
        if (rp.hostname or "").lower() != (parsed.hostname or "").lower() or rp.path != parsed.path:
            continue
        row_words = set(" ".join([row.get(f"headline_{i}", "") for i in range(1,4)] + [row.get(f"description_{i}", "") for i in range(1,3)]).lower().split())
        overlap = len(ad_words & row_words) / max(1, len(ad_words | row_words))
        candidates.append((overlap, row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    score, row = candidates[0]
    return {"row": row, "page": row["_page"], "pair_id": row["pair_id"], "match_confidence": round(score, 3)}
