def build_recommendations(evidence: list[dict]) -> list[dict]:
    out = []
    for i, item in enumerate(evidence, 1):
        if item["verified"] == "found":
            continue
        title = f"Review claim: {item['claim'][:90]}"
        replacement = item.get("correction") or f"Revise or qualify the claim “{item['claim']}” so it matches the landing page."
        out.append({
            "id": f"r{i}", "title": title, "explanation": item.get("explanation", ""),
            "priority": item["severity"], "fix": replacement,
            "benefit": "Estimated benefit: clearer expectation-setting may reduce ad-to-page confusion.",
            "replacement": replacement,
        })
    return out[:30]
