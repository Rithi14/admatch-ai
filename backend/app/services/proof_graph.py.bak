def build_proof_graph(
    evidence: list[dict] | None,
    sections: list[dict] | None,
) -> dict:
    """Build a graph connecting ad claims to evidence and page sections."""

    evidence = evidence or []
    sections = sections or []

    nodes = []
    edges = []

    section_lookup = {}

    # Create nodes for landing-page sections.
    for index, section in enumerate(sections, start=1):
        section_name = section.get("name", "Page content")
        section_id = f"section-{index}"

        section_lookup.setdefault(section_name, section_id)

        nodes.append(
            {
                "id": section_id,
                "type": "section",
                "label": section_name,
                "text": section.get("text", ""),
            }
        )

    # Create claim and evidence nodes.
    for index, item in enumerate(evidence, start=1):
        claim_id = f"claim-{index}"

        nodes.append(
            {
                "id": claim_id,
                "type": "claim",
                "label": item.get("claim", f"Claim {index}"),
                "status": item.get("verified", "unknown"),
            }
        )

        evidence_text = item.get("evidence")
        verified = item.get("verified", "unknown")

        # Only create an evidence connection when text was found.
        if not evidence_text or verified not in ("found", "partial"):
            continue

        evidence_id = f"evidence-{index}"

        nodes.append(
            {
                "id": evidence_id,
                "type": "evidence",
                "label": str(evidence_text)[:120],
                "text": str(evidence_text),
                "status": verified,
            }
        )

        edges.append(
            {
                "source": claim_id,
                "target": evidence_id,
                "type": "supported_by",
            }
        )

        # Connect evidence to its source section when available.
        location = item.get("location")

        if location in section_lookup:
            edges.append(
                {
                    "source": evidence_id,
                    "target": section_lookup[location],
                    "type": "located_in",
                }
            )

    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "claimCount": sum(
                node["type"] == "claim" for node in nodes
            ),
            "evidenceCount": sum(
                node["type"] == "evidence" for node in nodes
            ),
            "sectionCount": sum(
                node["type"] == "section" for node in nodes
            ),
            "connectionCount": len(edges),
        },
    }