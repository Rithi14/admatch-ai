from pathlib import Path
import os

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = Path(os.getenv("ADMATCH_DATASET_DIR", PROJECT_ROOT / "data" / "dataset"))
DATABASE_URL = os.getenv("ADMATCH_DATABASE_URL", f"sqlite:///{PROJECT_ROOT / 'data' / 'admatch.db'}")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ADMATCH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
MAX_PAGE_CHARS = int(os.getenv("ADMATCH_MAX_PAGE_CHARS", "200000"))
REQUEST_TIMEOUT_SECONDS = float(os.getenv("ADMATCH_REQUEST_TIMEOUT_SECONDS", "8"))
MAX_FETCH_BYTES = int(os.getenv("ADMATCH_MAX_FETCH_BYTES", "2000000"))
