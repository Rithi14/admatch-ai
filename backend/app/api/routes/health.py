from fastapi import APIRouter
from app.services.dataset_loader import get_dataset_stats

router = APIRouter()
@router.get("/health")
def health():
    return {"status": "ok", "service": "AdMatch AI API", "dataset": get_dataset_stats()}
