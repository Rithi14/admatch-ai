from datetime import datetime, timezone
from uuid import uuid4
from app.core.config import MAX_PAGE_CHARS
from app.services.claim_extractor import extract_claims
from app.services.content_extractor import extract_page_content
from app.services.dataset_loader import choose_dataset_page
from app.services.evidence_validator import find_evidence
from app.services.recommendations import build_recommendations
from app.services.scoring import score_audit

def _severity(claim: str) -> str:
    low = claim.lower()
    if any(term in low for term in ("guaranteed", "same-day", "instant", "100%", "no risk", "approved")):
        return "high"
    if any(term in low for term in ("free", "save", "discount", "up to", "no fee", "no cost", "from ")):
        return "medium"
    return "low"

def run_audit(payload, page_html: str | None = None, source: str = "pasted", dataset_match: dict | None = None) -> dict:
    page = extract_page_content(page_html) if page_html else {"title": "", "headings": [], "text": ""}
    page_text = (page.get("text") or "")[:MAX_PAGE_CHARS]
    claims = extract_claims(payload.headline, payload.body, payload.cta)
    evidence = []
    for i, claim in enumerate(claims, 1):
       
        result = find_evidence(
    claim,
    page_text,
    page.get("headings"),
    page.get("sections"),
)
        verified = result["verified"]
        severity = _severity(claim)
        if verified == "found":
            finding = "Claim appears in the landing page text."
            kind = "clarity"
        elif verified == "partial":
            finding = "Related wording was found, but the complete claim is not confirmed."
            kind = "weak"
        elif verified == "not_found":
            finding = "Claim not found in the available landing page text."
            kind = "missing"
        else:
            finding = "Unable to verify because landing page content is unavailable."
            kind = "clarity"
        evidence.append({
            "id": f"e{i}", "claim": claim, "evidence": result["evidence"], "verified": verified,
            "finding": finding, "severity": severity,
            "explanation": f"Evidence location: {result.get('location', 'unknown')}. Similarity indicator: {result.get('similarity', 0):.2f}.",
            "correction": "" if verified == "found" else f"Ensure the landing page clearly explains and substantiates: {claim}",
        })
    score, dimensions = score_audit(evidence, page_text, payload.headline, payload.cta or "")
    missing_count = sum(x["verified"] == "not_found" for x in evidence)
    partial_count = sum(x["verified"] == "partial" for x in evidence)
    summary = (
        f"Compared {len(claims)} ad claim(s) against {len(page_text.split())} words of landing-page text. "
        f"{missing_count} claim(s) were not found and {partial_count} claim(s) had only partial wording."
        if page_text else "Landing page content could not be obtained, so claims could not be verified."
    )
    findings = []
    for item in evidence:
        if item["verified"] != "found":
            findings.append({"id": f"f{len(findings)+1}", "kind": "missing" if item["verified"] == "not_found" else "weak" if item["verified"] == "partial" else "clarity", "title": item["finding"], "text": item["claim"]})
    recommendations = build_recommendations(evidence)
    url = payload.url
    if dataset_match:
        url = dataset_match["row"].get("final_url") or url
    return {
        "schemaVersion": 2, "id": str(uuid4()), "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "completed", "mode": "live", "isSample": False,
        "input": {"headline": payload.headline, "body": payload.body or "", "cta": payload.cta or "", "url": payload.url,
                  "audience": payload.audience or "", "goal": payload.goal or "", "industry": payload.industry or ""},
        "landingPage": {"url": url, "hostname": "", "contentSource": source if page_text else "none",
                        "content": page_text, "wordCount": len(page_text.split()), "title": page.get("title", ""),
                        "headings": page.get("headings", []),"sections": page.get("sections", []), **({"datasetPairId": dataset_match["pair_id"], "datasetMatchConfidence": dataset_match["match_confidence"]} if dataset_match else {})},
        "score": score, "dimensions": dimensions,
        "summary": summary,
        "findings": findings, "evidence": evidence, "recommendations": recommendations,
        "analysis": {"engine": "deterministic-evidence-mvp", "engineLabel": "Evidence-based rules (MVP)", "verified": bool(page_text),
                     "note": "Deterministic claim-to-page text matching; not an LLM or legal/financial verification."}
    }
