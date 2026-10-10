from typing import Literal
from pydantic import BaseModel, Field, HttpUrl, ConfigDict

class AuditCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    headline: str = Field(min_length=1, max_length=500)
    body: str = Field(default="", max_length=8000)
    cta: str | None = Field(default=None, max_length=300)
    url: str = Field(min_length=1, max_length=2048)
    audience: str | None = Field(default=None, max_length=500)
    goal: str | None = Field(default=None, max_length=100)
    industry: str | None = Field(default=None, max_length=150)
    landingPageText: str | None = Field(default=None, max_length=200000)

class AuditOut(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    createdAt: str
    status: Literal["completed"] = "completed"
    mode: Literal["live"] = "live"
    isSample: bool = False
    input: dict
    landingPage: dict
    score: int = Field(ge=0, le=100)
    dimensions: list[dict]
    summary: str
    findings: list[dict]
    evidence: list[dict]
    recommendations: list[dict]
    analysis: dict
