from app.services.claim_extractor import extract_claims


def test_headlines_are_split_into_individual_claims():
    claims = extract_claims(
        "Rates From 6.9% APR\nApply in 10 Minutes\nSame-Day Approval",
        "",
        "",
    )
    assert len(claims) == 3
    assert "Rates From 6.9% APR" in claims
    assert "Apply in 10 Minutes" in claims
    assert "Same-Day Approval" in claims


def test_duplicate_claims_are_removed():
    claims = extract_claims(
        "Free Trial\nFree Trial",
        "Free Trial",
        "",
    )
    assert len(claims) == 1
