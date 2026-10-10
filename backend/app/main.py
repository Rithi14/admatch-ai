from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import FRONTEND_ORIGINS
from app.db.database import init_db
from app.services.dataset_loader import get_dataset_stats

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="AdMatch AI API",
    description="Ad-to-landing-page message match auditor. Includes a local snapshot dataset benchmark.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)
app.include_router(api_router)

@app.get("/")
def root():
    return {"service": "AdMatch AI API", "docs": "/docs", "health": "/api/health"}

@app.get("/api/dataset")
def dataset_status():
    return get_dataset_stats()
