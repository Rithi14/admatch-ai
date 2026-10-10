import json
from app.db.database import connect, init_db

def save_audit(audit: dict) -> dict:
    init_db()
    with connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO audits(id, created_at, score, json_data) VALUES (?, ?, ?, ?)",
            (audit["id"], audit["createdAt"], audit["score"], json.dumps(audit, ensure_ascii=False)),
        )
    return audit

def list_audits() -> list[dict]:
    init_db()
    with connect() as conn:
        rows = conn.execute("SELECT json_data FROM audits ORDER BY created_at DESC").fetchall()
    return [json.loads(row["json_data"]) for row in rows]

def get_audit(audit_id: str) -> dict | None:
    init_db()
    with connect() as conn:
        row = conn.execute("SELECT json_data FROM audits WHERE id = ?", (audit_id,)).fetchone()
    return json.loads(row["json_data"]) if row else None

def delete_audit(audit_id: str) -> bool:
    init_db()
    with connect() as conn:
        cursor = conn.execute("DELETE FROM audits WHERE id = ?", (audit_id,))
    return cursor.rowcount > 0

def clear_audits() -> None:
    init_db()
    with connect() as conn:
        conn.execute("DELETE FROM audits")
