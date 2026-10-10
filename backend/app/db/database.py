import sqlite3
from pathlib import Path
from app.core.config import DATABASE_URL

def _db_path() -> Path:
    prefix = "sqlite:///"
    if not DATABASE_URL.startswith(prefix):
        raise RuntimeError("This MVP currently supports SQLite. Set ADMATCH_DATABASE_URL to sqlite:///path/to/file.db")
    path = Path(DATABASE_URL[len(prefix):])
    if not path.is_absolute():
        path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

def connect():
    connection = sqlite3.connect(_db_path(), timeout=10)
    connection.row_factory = sqlite3.Row
    return connection

def init_db():
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audits (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                score INTEGER NOT NULL,
                json_data TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC)")
