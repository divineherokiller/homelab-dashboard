import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config_loader import DEFAULT_CONFIG_PATH, load_config
from app.health import check_all_services
from app.models import AppConfig, ServiceStatus, StatusResponse

STATIC_DIR = Path(__file__).parent / "static"

_status_cache: list[ServiceStatus] = []
_status_lock = asyncio.Lock()
_last_check_at: datetime | None = None
_config: AppConfig | None = None


def _get_config() -> AppConfig:
    global _config
    if _config is None:
        _config = load_config()
    return _config


def _reload_config() -> AppConfig:
    global _config
    _config = load_config()
    return _config


def _build_summary(statuses: list[ServiceStatus]) -> dict[str, int]:
    summary = {"up": 0, "down": 0, "unknown": 0, "stale": 0}
    for item in statuses:
        summary[item.status] = summary.get(item.status, 0) + 1
    return summary


async def _refresh_status(force: bool = False) -> list[ServiceStatus]:
    global _last_check_at

    config = _get_config()
    refresh_seconds = config.dashboard.refresh_seconds

    async with _status_lock:
        now = datetime.now(timezone.utc)
        if (
            not force
            and _last_check_at
            and _status_cache
            and (now - _last_check_at).total_seconds() < refresh_seconds
        ):
            return _status_cache

        results = await check_all_services(config.services)
        _status_cache.clear()
        _status_cache.extend(results)
        _last_check_at = now
        return _status_cache


async def _background_refresh_loop() -> None:
    while True:
        try:
            config = _get_config()
            await _refresh_status(force=True)
            await asyncio.sleep(config.dashboard.refresh_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _reload_config()
    refresh_task = asyncio.create_task(_background_refresh_loop())
    yield
    refresh_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Homelab Dashboard", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/dashboard")
async def get_dashboard():
    config = _get_config()
    return {
        "title": config.dashboard.title,
        "refresh_seconds": config.dashboard.refresh_seconds,
        "sections": [s.model_dump() for s in config.sections if s.enabled],
    }


@app.get("/api/services")
async def get_services():
    config = _get_config()
    return [s.model_dump() for s in config.services]


@app.get("/api/bookmarks")
async def get_bookmarks():
    config = _get_config()
    return [b.model_dump() for b in config.bookmarks]


@app.get("/api/status", response_model=StatusResponse)
async def get_status(force: bool = False):
    statuses = await _refresh_status(force=force)
    return StatusResponse(services=statuses, summary=_build_summary(statuses))


@app.post("/api/reload")
async def reload_config():
    try:
        _reload_config()
        await _refresh_status(force=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"ok": True}


@app.get("/api/health")
async def health():
    return {"ok": True, "config": str(DEFAULT_CONFIG_PATH)}
