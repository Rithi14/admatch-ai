
"""Simple deterministic claim splitter for an explainable MVP; not an LLM."""
import re

def extract_claims(headline: str, body: str, cta: str | None = None) -> list[str]:
    pieces = [headline, body, cta or ""]
    claims = []
    for piece in pieces:
        for item in re.split(r"(?:[!?;]+|\.(?=\s|$)|\n+)", piece):
            claim = " ".join(item.split()).strip(" -•")
            if len(claim) >= 4 and claim.lower() not in {x.lower() for x in claims}:
                claims.append(claim)
    return claims[:30]
