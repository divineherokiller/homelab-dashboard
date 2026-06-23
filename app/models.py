from typing import Literal

from pydantic import BaseModel, Field


class DashboardConfig(BaseModel):
    title: str = "Homelab"
    refresh_seconds: int = Field(default=90, ge=30, le=600)


class SectionConfig(BaseModel):
    id: str
    title: str
    enabled: bool = True


class HealthCheckConfig(BaseModel):
    type: Literal["http", "tcp"] = "http"
    url: str | None = None
    host: str | None = None
    port: int | None = None
    timeout_ms: int = Field(default=3000, ge=500, le=10000)


class ServiceConfig(BaseModel):
    id: str
    name: str
    url: str
    section: str
    icon: str | None = None
    check: HealthCheckConfig | None = None


class BookmarkConfig(BaseModel):
    title: str
    url: str
    section: str = "bookmarks"
    pinned: bool = False


class AppConfig(BaseModel):
    dashboard: DashboardConfig = DashboardConfig()
    sections: list[SectionConfig] = []
    services: list[ServiceConfig] = []
    bookmarks: list[BookmarkConfig] = []


class ServiceStatus(BaseModel):
    id: str
    status: Literal["up", "down", "unknown", "stale"]
    checked_at: str | None = None
    message: str | None = None


class StatusResponse(BaseModel):
    services: list[ServiceStatus]
    summary: dict[str, int]
