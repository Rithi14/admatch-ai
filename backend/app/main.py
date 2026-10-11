
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.db.database import init_db
from app.services.dataset_loader import get_dataset_stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="AdMatch AI API",
    description=(
        "Ad-to-landing-page message match auditor. "
        "Includes a local snapshot dataset benchmark."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# Allowed frontend origins
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://admatch-ai.vercel.app",
]

# Optional additional origins from the Render environment
extra_origins = os.getenv("ADMATCH_CORS_ORIGINS", "")

allowed_origins.extend(
    origin.strip().rstrip("/")
    for origin in extra_origins.split(",")
    if origin.strip()
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins)),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Content-Type",
        "Authorization",
    ],
)


# Register API routes
app.include_router(api_router)


@app.get("/")
def root():
    return {
        "service": "AdMatch AI API",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/dataset")
def dataset_status():
    return get_dataset_stats()