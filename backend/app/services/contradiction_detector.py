import re

# Patterns that may indicate a claim conflicts with landing-page text.
CONTRADICTION_RULES = [
    {
        "name": "Free vs paid",
        "claim_patterns": [
            r"\bfree\b",
            r"\bno cost\b",
            r"\bzero cost\b",
        ],
        "page_patterns": [
            r"\bfees?\b",
            r"\bpaid\b",
            r"\bpayment required\b",
            r"₹\s*\d+",
            r"\$\s*\d+",
        ],
    },
    {
        "name": "Unlimited vs limited",
        "claim_patterns": [
            r"\bunlimited\b",
            r"\bno limits?\b",
        ],
        "page_patterns": [
            r"\blimited\b",
            r"\blimit of\b",
            r"\bup to \d+\b",
            r"\bmaximum of\b",
        ],
    },
    {
        "name": "No subscription vs recurring payment",
        "claim_patterns": [
            r"\bno subscription\b",
            r"\bone[- ]time payment\b",
            r"\bpay once\b",
        ],
        "page_patterns": [
            r"\bsubscription\b",
            r"\bmonthly billing\b",
            r"\brecurring payment\b",
            r"\bauto[- ]renew(?:al)?\b",
        ],
    },
    {
        "name": "Guaranteed vs not guaranteed",
        "claim_patterns": [
            r"\bguaranteed\b",
            r"\b100%\s*guarantee\b",
        ],
        "page_patterns": [
            r"\bnot guaranteed\b",
            r"\bno guarantee\b",
            r"\bresults may vary\b",
        ],
    },
]

FINE_PRINT_RULES = [
    (
        "Terms and conditions",
        r"\bterms and conditions apply\b|\bt&c apply\b",
    ),
    (
        "Additional fees",
        r"\badditional fees?\b|\bextra charges?\b|\bhidden charges?\b",
    ),
    (
        "Auto-renewal",
        r"\bauto[- ]renew(?:al)?\b|\bautomatically renews?\b",
    ),
    (
        "Eligibility restrictions",
        r"\beligibility requirements?\b|\beligible users?\b|\bsubject to eligibility\b",
    ),
    (
        "Limited offer",
        r"\blimited[- ]time offer\b|\boffer ends\b|\bwhile supplies last\b",
    ),
    (
        "Non-refundable",
        r"\bnon[- ]refundable\b|\bno refunds?\b",
    ),
    (
        "Conditions apply",
        r"\bconditions apply\b|\bsubject to conditions\b",
    ),
]

def _get_sections(sections: list[dict] | None) -> list[dict]:
    return sections or []

def _matches(patterns: list[str], text: str) -> bool:
    return any(
        re.search(pattern, text, re.IGNORECASE)
        for pattern in patterns
    )

def detect_issues(
    claims: list[str] | None,
    sections: list[dict] | None,
) -> dict:
    """Detect potential contradictions and fine-print wording using rules."""

    claims = claims or []
    sections = _get_sections(sections)

    contradictions = []
    fine_print = []

    seen_contradictions = set()
    seen_fine_print = set()

    # Check each advertisement claim against landing-page sections.
    for claim in claims:
        if not isinstance(claim, str) or not claim.strip():
            continue

        for rule in CONTRADICTION_RULES:
            if not _matches(rule["claim_patterns"], claim):
                continue

            for section in sections:
                section_text = str(section.get("text", ""))

                if not _matches(rule["page_patterns"], section_text):
                    continue

                evidence = next(
                    (
                        sentence.strip()
                        for sentence in re.split(
                            r"(?<=[.!?])\s+",
                            section_text,
                        )
                        if _matches(
                            rule["page_patterns"],
                            sentence,
                        )
                    ),
                    section_text[:500],
                )

                key = (
                    rule["name"],
                    claim.strip().lower(),
                    evidence.lower(),
                    section.get("name", "Page content"),
                )

                if key in seen_contradictions:
                    continue

                seen_contradictions.add(key)

                contradictions.append(
                    {
                        "type": rule["name"],
                        "claim": claim,
                        "evidence": evidence[:500],
                        "location": section.get(
                            "name",
                            "Page content",
                        ),
                        "severity": "high",
                        "message": (
                            "The landing page contains wording that "
                            "may conflict with this advertisement claim."
                        ),
                    }
                )

    # Scan page sections for fine-print wording.
    for section in sections:
        section_text = str(section.get("text", ""))
        location = section.get("name", "Page content")

        for label, pattern in FINE_PRINT_RULES:

            # Avoid duplicate labels for "Terms and conditions apply."
            # The more specific Terms and conditions rule takes priority.
            if (
                label == "Conditions apply"
                and re.search(
                    r"\bterms and conditions apply\b|\bt&c apply\b",
                    section_text,
                    re.IGNORECASE,
                )
            ):
                continue

            for match in re.finditer(
                pattern,
                section_text,
                re.IGNORECASE,
            ):
                # Find the beginning of the sentence containing the match.
                start = max(
                    0,
                    section_text.rfind(".", 0, match.start()) + 1,
                )

                # Find the end of that sentence.
                end_candidates = [
                    position
                    for position in (
                        section_text.find(".", match.end()),
                        section_text.find("!", match.end()),
                        section_text.find("?", match.end()),
                    )
                    if position != -1
                ]

                if end_candidates:
                    end = min(end_candidates) + 1
                else:
                    end = min(
                        len(section_text),
                        match.end() + 180,
                    )

                evidence = section_text[start:end].strip()

                key = (
                    label,
                    location,
                    evidence.lower(),
                )

                if key in seen_fine_print:
                    continue

                seen_fine_print.add(key)

                fine_print.append(
                    {
                        "type": label,
                        "evidence": evidence[:500],
                        "location": location,
                        "message": (
                            "Review this condition when evaluating "
                            "the advertisement claim."
                        ),
                    }
                )

    return {
        "contradictions": contradictions,
        "finePrint": fine_print,
        "summary": {
            "contradictionCount": len(contradictions),
            "finePrintCount": len(fine_print),
        },
    }