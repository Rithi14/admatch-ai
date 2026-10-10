from fastapi import APIRouter
from app.api.routes import audit, health

api_router = APIRouter()
api_router.include_router(health.router, prefix="/api", tags=["health"])
api_router.include_router(audit.router, prefix="/api", tags=["audits"])
