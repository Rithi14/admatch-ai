from app.services.dataset_loader import load_dataset


def test_benchmark_contains_60_unique_pairs_with_snapshots():
    records = load_dataset()

    assert len(records) == 60
    assert len({row["pair_id"] for row in records}) == 60

    for row in records:
        assert row["_snapshot_path"]
        assert row["_page"].get("text", "").strip()


def test_benchmark_rows_have_ad_copy_and_urls():
    records = load_dataset()

    for row in records:
        assert row.get("final_url")
        assert any(row.get(f"headline_{i}", "").strip() for i in range(1, 4))
        assert any(row.get(f"description_{i}", "").strip() for i in range(1, 3))
