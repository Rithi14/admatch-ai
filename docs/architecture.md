# AdMatch AI backend architecture

```text
React frontend
  -> /api/audits
    -> AuditCreate validation (Pydantic)
    -> Dataset lookup (fictional .example URLs) OR pasted text OR guarded public fetch
    -> HTML content extraction
    -> claim extraction
    -> evidence matching (exact quote / partial / not found / unable)
    -> deterministic scoring and recommendations
    -> SQLite repository
    -> schema-v2 audit JSON response
```

## Main boundaries
- `api/routes`: HTTP endpoints only.
- `schemas`: input validation.
- `services`: dataset loading, extraction, analysis, scoring, evidence and recommendations.
- `core/security.py`: URL and redirect guardrails.
- `db`: SQLite persistence.
- `tests`: basic API, evidence and scoring checks.

The current scoring engine is a transparent heuristic baseline. It does not use an LLM, prove financial claims, or infer visual prominence from DOM layout. The next recommended stage is benchmark evaluation against all 60 pairs with human-labelled expected outcomes.
