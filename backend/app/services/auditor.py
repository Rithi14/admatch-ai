from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import MAX_PAGE_CHARS
from app.services.claim_extractor import extract_claims
from app.services.content_extractor import extract_page_content
from app.services.dataset_loader import choose_dataset_page
from app.services.evidence_validator import find_evidence
from app.services.recommendations import build_recommendations
from app.services.scoring import score_audit
from app.services.contradiction_detector import detect_issues
from app.services.proof_graph import build_proof_graph


def _severity(claim: str) -> str:
    low = claim.lower()

    if any(
        term in low
        for term in (
            "guaranteed",
            "same-day",
            "instant",
            "100%",
            "no risk",
            "approved",
        )
    ):
        return "high"

    if any(
        term in low
        for term in (
            "free",
            "save",
            "discount",
            "up to",
            "no fee",
            "no cost",
            "from ",
        )
    ):
        return "medium"

    return "low"


def run_audit(
    payload,
    page_html: str | None = None,
    source: str = "pasted",
    dataset_match: dict | None = None,
) -> dict:

    # Step 1: Extract landing-page content and sections.
    page = (
        extract_page_content(page_html)
        if page_html
        else {
            "title": "",
            "headings": [],
            "text": "",
            "sections": [],
        }
    )

    page_text = (page.get("text") or "")[:MAX_PAGE_CHARS]
    sections = page.get("sections", [])

    # Step 2: Extract claims from the advertisement.
    claims = extract_claims(
        payload.headline,
        payload.body,
        payload.cta,
    )

    # Step 3: Verify each claim against the landing page.
    evidence = []

    for i, claim in enumerate(claims, 1):
        result = find_evidence(
            claim,
            page_text,
            page.get("headings"),
            sections,
        )

        verified = result["verified"]
        severity = _severity(claim)

        if verified == "found":
            finding = "Claim appears in the landing page text."

        elif verified == "partial":
            finding = (
                "Related wording was found, but the complete "
                "claim is not confirmed."
            )

        elif verified == "not_found":
            finding = (
                "Claim not found in the available landing page text."
            )

        else:
            finding = (
                "Unable to verify because landing page content "
                "is unavailable."
            )

        evidence.append(
            {
                "id": f"e{i}",
                "claim": claim,
                "evidence": result["evidence"],
                "verified": verified,
                "location": result.get("location", "unknown"),
                "finding": finding,
                "severity": severity,
                "explanation": (
                    f"Evidence location: "
                    f"{result.get('location', 'unknown')}. "
                    f"Similarity indicator: "
                    f"{result.get('similarity', 0):.2f}."
                ),
                "correction": (
                    ""
                    if verified == "found"
                    else (
                        "Ensure the landing page clearly explains "
                        f"and substantiates: {claim}"
                    )
                ),
            }
        )

    # Step 4: Calculate the audit score.
    score, dimensions = score_audit(
        evidence,
        page_text,
        payload.headline,
        payload.cta or "",
    )

    missing_count = sum(
        item["verified"] == "not_found"
        for item in evidence
    )

    partial_count = sum(
        item["verified"] == "partial"
        for item in evidence
    )

    if page_text:
        summary = (
            f"Compared {len(claims)} ad claim(s) against "
            f"{len(page_text.split())} words of landing-page text. "
            f"{missing_count} claim(s) were not found and "
            f"{partial_count} claim(s) had only partial wording."
        )
    else:
        summary = (
            "Landing page content could not be obtained, "
            "so claims could not be verified."
        )

    # Step 5: Create findings for missing or weak evidence.
    findings = []

    for item in evidence:
        if item["verified"] != "found":
            if item["verified"] == "not_found":
                kind = "missing"
            elif item["verified"] == "partial":
                kind = "weak"
            else:
                kind = "clarity"

            findings.append(
                {
                    "id": f"f{len(findings) + 1}",
                    "kind": kind,
                    "title": item["finding"],
                    "text": item["claim"],
                }
            )

    # Step 6: Generate recommendations.
    recommendations = build_recommendations(evidence)

    # Step 7: Detect contradictions and fine print.
    issue_results = detect_issues(
        claims,
        sections,
    )

    contradictions = issue_results["contradictions"]
    fine_print = issue_results["finePrint"]
    proof_graph = build_proof_graph(
    evidence,
    sections,
)

    # Step 8: Add contradiction findings.
    for item in contradictions:
        findings.append(
            {
                "id": f"f{len(findings) + 1}",
                "kind": "contradiction",
                "title": item["type"],
                "text": item["evidence"],
                "location": item["location"],
                "severity": item["severity"],
            }
        )

    # Step 9: Add fine-print findings.
    for item in fine_print:
        findings.append(
            {
                "id": f"f{len(findings) + 1}",
                "kind": "fine_print",
                "title": item["type"],
                "text": item["evidence"],
                "location": item["location"],
            }
        )

    # Step 10: Resolve the landing-page URL.
    url = payload.url

    if dataset_match:
        url = dataset_match["row"].get("final_url") or url

    # Step 11: Return the complete audit result.
    return {
        "schemaVersion": 2,
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "completed",
        "mode": "live",
        "isSample": False,

        "input": {
            "headline": payload.headline,
            "body": payload.body or "",
            "cta": payload.cta or "",
            "url": payload.url,
            "audience": payload.audience or "",
            "goal": payload.goal or "",
            "industry": payload.industry or "",
        },

        "landingPage": {
            "url": url,
            "hostname": "",
            "contentSource": source if page_text else "none",
            "content": page_text,
            "wordCount": len(page_text.split()),
            "title": page.get("title", ""),
            "headings": page.get("headings", []),
            "sections": sections,
            **(
                {
                    "datasetPairId": dataset_match["pair_id"],
                    "datasetMatchConfidence": (
                        dataset_match["match_confidence"]
                    ),
                }
                if dataset_match
                else {}
            ),
        },

        "score": score,
        "dimensions": dimensions,
        "summary": summary,
        "findings": findings,
        "evidence": evidence,
        "recommendations": recommendations,

        # New Feature 2 response fields.
        "contradictions": contradictions,
        "finePrint": fine_print,
        "issueSummary": issue_results["summary"],
        "proofGraph": proof_graph,

        "analysis": {
            "engine": "deterministic-evidence-mvp",
            "engineLabel": "Evidence-based rules (MVP)",
            "verified": bool(page_text),
            "note": (
                "Deterministic claim-to-page text matching; "
                "not an LLM or legal/financial verification."
            ),
        },
    }