from fastapi import APIRouter, HTTPException, Response
from app.schemas.audit import AuditCreate
from app.db.repository import save_audit, list_audits, get_audit, delete_audit, clear_audits
from app.core.config import REQUEST_TIMEOUT_SECONDS, MAX_FETCH_BYTES
from app.core.security import fetch_public_page, UnsafeURLError
from app.services.dataset_loader import choose_dataset_page
from app.services.auditor import run_audit

router = APIRouter()

@router.post("/audits", status_code=201)
async def create_audit(payload: AuditCreate):
    page_html = None
    source = "none"
    dataset_match = None
    # Supplied dataset pages take precedence for fictional benchmark URLs.
    dataset_match = choose_dataset_page(payload.url, payload.headline, payload.body)
    if dataset_match:
        page_html = (dataset_match["row"].get("_snapshot_path"))
        from pathlib import Path
        page_html = Path(page_html).read_text(encoding="utf-8", errors="replace")
        source = "fetched"
    elif payload.landingPageText and payload.landingPageText.strip():
        page_html = payload.landingPageText
        source = "pasted"
    else:
        try:
            page_html = await fetch_public_page(payload.url, REQUEST_TIMEOUT_SECONDS, MAX_FETCH_BYTES)
            source = "fetched"
        except UnsafeURLError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not retrieve landing page. Paste its visible text in the form and retry. ({type(exc).__name__})") from exc
    audit = run_audit(payload, page_html, source, dataset_match)
    from urllib.parse import urlparse
    audit["landingPage"]["hostname"] = (urlparse(payload.url).hostname or "").replace("www.", "")
    return save_audit(audit)

@router.get("/audits")
def get_audits():
    return {"items": list_audits()}

@router.get("/audits/{audit_id}")
def get_one_audit(audit_id: str):
    audit = get_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found.")
    return audit

@router.delete("/audits/{audit_id}", status_code=204)
def remove_audit(audit_id: str):
    if not delete_audit(audit_id):
        raise HTTPException(status_code=404, detail="Audit not found.")
    return Response(status_code=204)

@router.delete("/audits", status_code=204)
def remove_all_audits():
    clear_audits()
    return Response(status_code=204)
