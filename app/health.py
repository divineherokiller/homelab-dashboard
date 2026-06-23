import asyncio
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app.models import HealthCheckConfig, ServiceConfig, ServiceStatus

CHECK_CONCURRENCY = 5


async def _check_http(check: HealthCheckConfig) -> tuple[bool, str]:
    if not check.url:
        return False, "No URL configured"

    timeout = check.timeout_ms / 1000
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            verify=False,
        ) as client:
            response = await client.get(check.url)
            if response.status_code < 500:
                return True, f"HTTP {response.status_code}"
            return False, f"HTTP {response.status_code}"
    except httpx.TimeoutException:
        return False, "Timeout"
    except httpx.RequestError as exc:
        return False, str(exc) or "Request failed"


async def _check_tcp(check: HealthCheckConfig) -> tuple[bool, str]:
    host = check.host
    port = check.port

    if check.url and not (host and port):
        parsed = urlparse(check.url)
        host = parsed.hostname
        port = parsed.port or (443 if parsed.scheme == "https" else 80)

    if not host or not port:
        return False, "Host/port not configured"

    timeout = check.timeout_ms / 1000

    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.close()
        await writer.wait_closed()
        return True, f"TCP {host}:{port}"
    except (asyncio.TimeoutError, OSError) as exc:
        return False, str(exc) or "Connection failed"


async def check_service(service: ServiceConfig) -> ServiceStatus:
    checked_at = datetime.now(timezone.utc).isoformat()

    if not service.check:
        return ServiceStatus(
            id=service.id,
            status="unknown",
            checked_at=checked_at,
            message="No health check configured",
        )

    check = service.check
    try:
        if check.type == "http":
            ok, message = await _check_http(check)
        else:
            ok, message = await _check_tcp(check)
    except Exception as exc:
        return ServiceStatus(
            id=service.id,
            status="down",
            checked_at=checked_at,
            message=str(exc),
        )

    return ServiceStatus(
        id=service.id,
        status="up" if ok else "down",
        checked_at=checked_at,
        message=message,
    )


async def check_all_services(services: list[ServiceConfig]) -> list[ServiceStatus]:
    semaphore = asyncio.Semaphore(CHECK_CONCURRENCY)

    async def run_with_limit(service: ServiceConfig) -> ServiceStatus:
        async with semaphore:
            return await check_service(service)

    return list(await asyncio.gather(*(run_with_limit(s) for s in services)))
