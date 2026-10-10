# AdMatch AI Backend

AdMatch AI is a transparent ad-to-landing-page audit backend designed to evaluate message consistency, surface unsupported claims, and produce explainable benchmark results for local review workflows.

The backend is intentionally deterministic and evidence-first: it extracts ad claims, compares them against landing-page content, and reports what is supported, partially supported, or missing. It also supports a benchmark workflow for evaluating a fixed 60-pair dataset while preserving the human-reviewed ground truth as the final source of truth.

## Why this backend exists

Marketing and ad quality teams need a defensible answer to a simple question:

Does the landing page actually support the promises made in the ad?

This backend helps by:

- extracting and normalizing claims from ad copy
- analyzing landing-page snapshot text and structure
- identifying evidence that supports or contradicts each claim
- scoring message match quality with explainable findings
- supporting benchmark evaluation using a local dataset
- keeping human-reviewed labels separate from model-generated predictions

## Core capabilities

- FastAPI-based REST API for ad audits
- deterministic claim extraction and evidence matching
- local dataset benchmarking against `.example` landing-page snapshots
- generation of benchmark result reports and evaluation metrics
- review-ready ground-truth CSV workflow for human validation
- explicit handling of blank, uncertain, and invalid labels
- null-safe metric reporting when there is not enough human evidence

## Stack

- Python 3.13+
- FastAPI
- Pydantic v2
- SQLite
- BeautifulSoup4
- httpx
- pytest

## Repository layout

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
├── reports/
│   ├── benchmark_results.json
│   ├── benchmark_results.csv
│   ├── benchmark_metrics.json
│   ├── benchmark_metrics.csv
│   ├── ground_truth_review.csv
│   └── ground_truth_template.csv
├── scripts/
│   ├── evaluate_benchmark.py
│   └── run_benchmark.py
├── tests/
│   ├── test_audit_api.py
│   ├── test_benchmark_evaluation.py
│   ├── test_evidence_validator.py
│   └── test_scoring.py
├── .env.example
├── README.md
├── requirements.txt
└── .gitignore
```

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

```bash
cp .env.example .env
```

Common settings include:

| Variable | Purpose | Default |
|---|---|---|
| `ADMATCH_DATASET_DIR` | benchmark data directory | `backend/data/dataset` |
| `ADMATCH_DATABASE_URL` | SQLite path | `sqlite:///.../data/admatch.db` |
| `ADMATCH_CORS_ORIGINS` | allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `ADMATCH_REQUEST_TIMEOUT_SECONDS` | HTTP timeout | `8` |
| `ADMATCH_MAX_FETCH_BYTES` | fetch size cap | `2000000` |
| `ADMATCH_MAX_PAGE_CHARS` | max page-text length | `200000` |

### 4) Run the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Useful local URLs:

- API docs: http://localhost:8000/docs
- Health endpoint: http://localhost:8000/api/health
- Dataset status: http://localhost:8000/api/dataset

## API overview

### Health

```http
GET /api/health
```

Returns service health and dataset availability.

### Dataset metadata

```http
GET /api/dataset
```

Returns dataset shape and benchmark status metadata.

### Create audit

```http
POST /api/audits
```

Creates a claim-audit evaluation using:

- a live URL when permitted
- a local benchmark snapshot for `.example` domains
- or pasted `landingPageText` as a fallback

Example request:

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

### List and fetch audits

```http
GET /api/audits
GET /api/audits/{audit_id}
DELETE /api/audits/{audit_id}
DELETE /api/audits
```

## Benchmark and evaluation workflow

The benchmark flow is built around a fixed dataset of ad and landing-page pairs. The canonical workflow is:

```bash
cd backend
.venv/bin/python scripts/run_benchmark.py
.venv/bin/python scripts/evaluate_benchmark.py
```

### Benchmark runner

`backend/scripts/run_benchmark.py`:

- loads benchmark records from the local dataset
- audits each ad-to-page pair
- writes `backend/reports/benchmark_results.json`
- writes `backend/reports/benchmark_results.csv`
- keeps `ground_truth_review.csv` stable while preserving any current human-reviewed values

### Evaluation script

`backend/scripts/evaluate_benchmark.py`:

- reads benchmark results and the human review CSV
- validates pair IDs, duplicates, and invalid labels
- excludes blank and uncertain labels from binary metric calculations
- computes TP/FP/FN/TN, precision, recall, F1, and accuracy only from valid human-reviewed `true` / `false` values
- writes `benchmark_metrics.json` and `benchmark_metrics.csv`
- returns `awaiting_human_review` when there are not enough valid labels

Important: the benchmark output may produce a heuristic mismatch signal via `not_found_count > 0`, but this is never treated as definitive truth. It is a proxy only, not a substitute for human review.

## Ground truth requirements

Human review remains the only valid source of benchmark labels. This backend intentionally enforces the following rules:

- allowed values are `true`, `false`, `uncertain`, and blank
- blank means not reviewed
- `uncertain` is excluded from binary metrics and reported separately
- `true` means at least one material mismatch was confirmed
- `false` means no material mismatch was confirmed
- model predictions are never used as ground truth
- existing human-entered values are preserved when files are regenerated

## Testing

Run the suite with:

```bash
cd backend
.venv/bin/python -m pytest -q
```

The test suite covers API behavior, scoring logic, evidence validation, and the benchmark evaluation workflow, including edge cases such as zero denominators, invalid labels, duplicate IDs, and no-review scenarios.

## Security and guardrails

The backend includes safeguards for network or dataset access:

- restricted URL handling
- fetch-size caps and timeout controls
- dataset directory validation
- explainable, local-first benchmarking without depending on live external systems

## Notes

This project is best understood as a transparent evidence engine for ad-message alignment and benchmark evaluation. It is suited for local experiments, reproducible QA workflows, and human-in-the-loop review pipelines.

## License

Review the repository-level license before production deployment or redistribution.

