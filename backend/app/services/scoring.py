def score_audit(evidence: list[dict], page_text: str, headline: str, cta: str = "") -> tuple[int, list[dict]]:
    if not page_text.strip():
        return 0, [
            {"key": "message_match", "label": "Message match", "score": None, "note": "Landing page content was unavailable."},
            {"key": "promise_fulfillment", "label": "Promise fulfillment", "score": None, "note": "Cannot evaluate without page content."},
            {"key": "cta_alignment", "label": "CTA alignment", "score": None, "note": "Cannot evaluate without page content."},
        ]
    if not evidence:
        score = 50
    else:
        weighted = {"found": 1.0, "partial": 0.55, "not_found": 0.0, "unable": 0.25}
        points = [weighted.get(item["verified"], 0.25) * ({"high": 1.5, "medium": 1.0, "low": 0.7}.get(item["severity"], 1.0)) for item in evidence]
        weights = [({"high": 1.5, "medium": 1.0, "low": 0.7}.get(item["severity"], 1.0)) for item in evidence]
        score = round(100 * sum(points) / max(1, sum(weights)))
    headline_terms = {w.lower().strip(".,!?") for w in headline.split() if len(w) > 3}
    page_terms = {w.lower().strip(".,!?") for w in page_text.split() if len(w) > 3}
    message = round(100 * len(headline_terms & page_terms) / max(1, len(headline_terms))) if headline_terms else None
    cta_score = None
    if cta:
        cta_terms = {w.lower().strip(".,!?") for w in cta.split() if len(w) > 2}
        cta_score = round(100 * len(cta_terms & page_terms) / max(1, len(cta_terms))) if cta_terms else None
    dimensions = [
        {"key": "message_match", "label": "Message consistency", "score": message, "note": "Keyword overlap indicator; not semantic AI evaluation."},
        {"key": "promise_fulfillment", "label": "Promise fulfillment", "score": score, "note": "Based on claim evidence classifications."},
        {"key": "cta_alignment", "label": "CTA alignment", "score": cta_score, "note": "Keyword overlap indicator; not a conversion prediction."},
    ]
    return max(0, min(100, score)), dimensions
