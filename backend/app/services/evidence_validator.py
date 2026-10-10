import re
from difflib import SequenceMatcher

def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9%$₹€£]+", " ", (text or "").lower()).strip()

def find_evidence(claim: str, page_text: str, headings: list[str] | None = None) -> dict:
    """Returns only a verbatim page sentence as evidence; never fabricates quotations."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|(?<=\n)", page_text or "") if len(s.strip()) > 8]
    claim_n = norm(claim)
    page_n = norm(page_text)
    if not claim_n or not page_n:
        return {"evidence": None, "verified": "unable", "similarity": 0.0, "location": "unknown"}
    if claim_n in page_n:
        for sentence in sentences:
            if claim_n in norm(sentence):
                return {"evidence": sentence[:700], "verified": "found", "similarity": 1.0, "location": _location(sentence, headings)}
        return {"evidence": claim, "verified": "found", "similarity": 1.0, "location": "page text"}
    tokens = {t for t in claim_n.split() if len(t) > 2}
    best = (0.0, "")
    for sentence in sentences:
        sn = norm(sentence)
        st = {t for t in sn.split() if len(t) > 2}
        overlap = len(tokens & st) / max(1, len(tokens))
        ratio = SequenceMatcher(None, claim_n, sn).ratio()
        score = max(overlap, ratio * 0.75)
        if score > best[0]:
            best = (score, sentence)
    if best[0] >= 0.55:
        return {"evidence": best[1][:700], "verified": "partial", "similarity": round(best[0], 3), "location": _location(best[1], headings)}
    return {"evidence": None, "verified": "not_found", "similarity": round(best[0], 3), "location": "not found"}

def _location(sentence: str, headings: list[str] | None) -> str:
    if headings:
        return "main content"
    return "page content"
