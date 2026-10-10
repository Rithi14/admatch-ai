
import re
from difflib import SequenceMatcher


def norm(text: str) -> str:
    return re.sub(
        r"[^a-z0-9%$₹€£]+",
        " ",
        (text or "").lower(),
    ).strip()


def _location(sentence: str, sections: list[dict] | None) -> str:
    sentence_norm = norm(sentence)

    for section in sections or []:
        section_text = norm(section.get("text", ""))

        if sentence_norm and sentence_norm in section_text:
            return section.get("name") or "Main content"

    return "Page content"


def find_evidence(
    claim: str,
    page_text: str,
    headings: list[str] | None = None,
    sections: list[dict] | None = None,
) -> dict:
    """Match claims against section sentences and return their locations."""

    claim_norm = norm(claim)

    if not claim_norm or not norm(page_text):
        return {
            "evidence": None,
            "verified": "unable",
            "similarity": 0.0,
            "location": "unknown",
        }

    # Prefer individual sentences from their actual page sections.
    candidates = []

    for section in sections or []:
        section_name = section.get("name") or "Main content"
        section_sentences = section.get("sentences") or []

        # Support section data that has text but no sentences list.
        if not section_sentences:
            section_sentences = re.split(
                r"(?<=[.!?])\s+|\n+",
                section.get("text", ""),
            )

        for sentence in section_sentences:
            sentence = sentence.strip()

            if len(sentence) > 8:
                candidates.append((sentence, section_name))

    # Backwards-compatible fallback when sections are unavailable.
    if not candidates:
        page_sentences = re.split(
            r"(?<=[.!?])\s+|\n+",
            page_text or "",
        )
        candidates = [
            (sentence.strip(), "Page content")
            for sentence in page_sentences
            if len(sentence.strip()) > 8
        ]

    # First, look for a direct claim match in a single sentence.
    for sentence, section_name in candidates:
        if claim_norm in norm(sentence):
            return {
                "evidence": sentence[:700],
                "verified": "found",
                "similarity": 1.0,
                "location": section_name,
            }

    # Otherwise, find the strongest partial match.
    claim_tokens = {
        token for token in claim_norm.split() if len(token) > 2
    }
    best_score = 0.0
    best_sentence = ""
    best_location = "not found"

    for sentence, section_name in candidates:
        sentence_norm = norm(sentence)
        sentence_tokens = {
            token for token in sentence_norm.split() if len(token) > 2
        }

        overlap = len(claim_tokens & sentence_tokens) / max(
            1, len(claim_tokens)
        )
        ratio = SequenceMatcher(
            None, claim_norm, sentence_norm
        ).ratio()
        score = max(overlap, ratio * 0.75)

        if score > best_score:
            best_score = score
            best_sentence = sentence
            best_location = section_name

    if best_score >= 0.55:
        return {
            "evidence": best_sentence[:700],
            "verified": "partial",
            "similarity": round(best_score, 3),
            "location": best_location,
        }

    return {
        "evidence": None,
        "verified": "not_found",
        "similarity": round(best_score, 3),
        "location": "not found",
    }