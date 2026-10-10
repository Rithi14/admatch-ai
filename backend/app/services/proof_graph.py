def build_proof_graph(
    evidence: list[dict] | None,
    sections: list[dict] | None,
) -> dict:
    """Build an evidence graph without inventing support for claims."""

    evidence = evidence or []
    sections = sections or []

    nodes = []
    edges = []
    section_lookup = {}

    def normalize(value: str) -> str:
        return " ".join(value.casefold().split())

    # Create section nodes and a normalized section lookup.
    for index, section in enumerate(sections, start=1):
        name = str(section.get("name") or "Page content")
        section_id = f"section-{index}"

        nodes.append({
            "id": section_id,
            "type": "section",
            "label": name,
            "text": str(section.get("text") or ""),
        })

        section_lookup.setdefault(normalize(name), section_id)

    claim_count = 0

    for index, item in enumerate(evidence, start=1):
        claim_id = f"claim-{index}"
        claim = str(item.get("claim") or f"Claim {index}")
        status = str(item.get("verified") or "unknown").lower()
        evidence_text = item.get("evidence")

        # Normalize known status values.
        if status in ("found", "verified", "supported"):
            status = "found"
        elif status in ("partial", "partially_supported"):
            status = "partial"
        elif status in ("not_found", "unsupported", "missing"):
            status = "not_found"

        claim_count += 1

        nodes.append({
            "id": claim_id,
            "type": "claim",
            "label": claim,
            "status": status,
        })

        # Missing or unverified text must never become fake evidence.
        if not isinstance(evidence_text, str) or not evidence_text.strip():
            continue

        if status not in ("found", "partial"):
            continue

        evidence_id = f"evidence-{index}"

        nodes.append({
            "id": evidence_id,
            "type": "evidence",
            "label": evidence_text.strip()[:120],
            "text": evidence_text.strip(),
            "status": status,
        })

        edges.append({
            "source": claim_id,
            "target": evidence_id,
            "type": "supported_by" if status == "found" else "partially_supported_by",
        })

        # Connect only to a section that actually exists.
        location = item.get("location")
        if isinstance(location, str) and location.strip():
            section_id = section_lookup.get(normalize(location))
            if section_id:
                edges.append({
                    "source": evidence_id,
                    "target": section_id,
                    "type": "located_in",
                })

    node_ids = {node["id"] for node in nodes}

    # Defensive validation: every edge must reference existing nodes.
    edges = [
        edge for edge in edges
        if edge["source"] in node_ids and edge["target"] in node_ids
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "claimCount": sum(node["type"] == "claim" for node in nodes),
            "evidenceCount": sum(node["type"] == "evidence" for node in nodes),
            "sectionCount": sum(node["type"] == "section" for node in nodes),
            "connectionCount": len(edges),
        },
    }
