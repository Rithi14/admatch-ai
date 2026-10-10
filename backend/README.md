# AdMatch AI Backend

A FastAPI-based backend for auditing ad-to-landing-page message consistency. The service compares an ad's claims against the actual landing page content, identifies missing or weak evidence, and returns a deterministic score, explanations, and recommendations.

This backend powers a benchmark-focused workflow for evaluating message match quality using a local dataset of fictional ad/landing-page pairs. It is designed to be transparent, inspectable, and easy to run locally without depending on live external URLs.

## Why this backend exists

Marketing and ad quality teams often need to answer a simple but important question: does the landing page actually support the promises made in the ad?

This API helps by:

- extracting claims from ad text
- retrieving or using local landing-page content
- checking whether each claim is supported by evidence
- calculating a message-match score
- surfacing contradictions, fine-print issues, and recommendations
- storing audit results in SQLite for review and troubleshooting

## Stack

- Python 3.13+
- FastAPI
- Pydantic v2
- SQLite
- BeautifulSoup4
- httpx
- pytest

## Project structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── audit.py
│   │   │   └── health.py
│   │   └── router.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── db/
│   │   ├── database.py
│   │   └── repository.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   │   ├── auditor.py
│   │   ├── claim_extractor.py
│   │   ├── content_extractor.py
│   │   ├── contradiction_detector.py
│   │   ├── dataset_loader.py
│   │   ├── evidence_validator.py
│   │   ├── recommendations.py
│   │   ├── scoring.py
│   │   └── scraper.py
│   ├── utils/
│   ├── main.py
│   └── __init__.py
├── data/
│   └── dataset/
├── docs/
│   └── architecture.md
├── tests/
│   ├── test_audit_api.py
│   ├── test_evidence_validator.py
│   └── test_scoring.py
├── .env.example
├── README.md
├── requirements.txt
└── .gitignore
```

## Features

- Deterministic claim-to-page verification using extracted page text
- Support for dataset-backed benchmark evaluation with local HTML snapshots
- Optional pasted landing page text fallback for manual audits
- Guarded URL fetching with strict rules for external page retrieval
- SQLite-backed audit persistence
- REST API with Swagger/OpenAPI docs via FastAPI
- Transparency-focused scoring with evidence, findings, and recommendations

## Quick start

### 1) Create and activate a virtual environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Configure environment variables

Copy the example environment file if needed:

```bash
cp .env.example .env
```

The backend reads the following settings from environment variables or defaults:

| Variable | Purpose | Default |
|---|---|---|
| `ADMATCH_DATASET_DIR` | dataset directory for local benchmark pages | `backend/data/dataset` |
| `ADMATCH_DATABASE_URL` | SQLite database path | `sqlite:///.../data/admatch.db` |
| `ADMATCH_CORS_ORIGINS` | allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `ADMATCH_REQUEST_TIMEOUT_SECONDS` | fetch timeout for remote page retrieval | `8` |
| `ADMATCH_MAX_FETCH_BYTES` | cap for fetched page content | `2000000` |
| `ADMATCH_MAX_PAGE_CHARS` | max page text length used in analysis | `200000` |

### 4) Run the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open:

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health
- Dataset status: http://localhost:8000/api/dataset

## API overview

### Health

```http
GET /api/health
```

Returns service health plus dataset status.

### Dataset metadata

```http
GET /api/dataset
```

Returns the number of benchmark pairs and whether the dataset is available.

### Create audit

```http
POST /api/audits
```

Creates an audit using:

- a live URL, if allowed and available
- a local benchmark dataset match for fictional `.example` URLs
- or pasted `landingPageText` when the page cannot be fetched

Request body example:

```json
{
  "headline": "Get approved in as little as 24 hours",
  "body": "Fast funding for small businesses. No paperwork. No hidden fees.",
  "cta": "Apply now",
  "url": "https://northpeakfinancing.example/loans",
  "audience": "Small business owners",
  "goal": "Lead generation",
  "industry": "Financial services",
  "landingPageText": "We help businesses access funding with transparent terms and a simple application process."
}
```

### List audits

```http
GET /api/audits
```

Returns stored audit summaries.

### Fetch one audit

```http
GET /api/audits/{audit_id}
```

### Delete audits

```http
DELETE /api/audits/{audit_id}
DELETE /api/audits
```

## Audit response

Each audit includes:

- `id` and timestamps
- input data from the request
- `landingPage` metadata and page content summary
- `score` from 0 to 100
- `dimensions` with score breakdowns
- `summary` of the overall match quality
- `findings` for missing/weak/contradictory claims
- `evidence` with matched or missing quotes
- `recommendations` for improving message alignment
- `contradictions` and `finePrint` sections
- `issueSummary` for reporting aggregate issues

## How the audit works

The backend follows a transparent pipeline:

1. validate the incoming audit payload
2. resolve landing page content from dataset, pasted text, or guarded remote fetch
3. extract ad claims
4. match claims against the landing page text and headings
5. detect contradictions and fine print issues
6. compute a score and recommendations
7. persist the result to SQLite

This is intentionally a deterministic evidence-based MVP rather than a legal or financial verification engine.

## Benchmark dataset

The project includes a static benchmark dataset for fictional ads and landing pages. This is useful for evaluating algorithmic performance without depending on live network conditions.

The dataset contains:

- ad metadata and copy fields
- landing page snapshot HTML files
- deterministic matching against `.example` URLs

This design keeps the benchmark reliable and reproducible.

## Testing

Run the test suite with:

```bash
pytest
```

Key tests cover:

- health endpoint contract
- dataset metadata exposure
- evidence validation behavior
- scoring behavior

## Security and guardrails

The backend includes safeguards for external page fetching:

- restricted URL handling for safe public pages
- redirect and fetch controls
- byte limits on retrieved content
- dataset path validation to avoid escapes outside the benchmark directory

## Notes

This project is best understood as a transparent scoring and evidence engine for ad-message alignment, not as a broad legal/financial compliance system. It is suited for local benchmarking, experimentation, and MVP validation workflows.

## License

This project is intended for internal evaluation and demo usage. Review the repository-level license before production deployment or redistribution.

