"""
AeroLink API Gateway
--------------------
Single public entry point for the AeroLink microservices platform.

Responsibilities:
- Route client requests to the correct internal microservice
- Validate JWT tokens by calling the Auth Service
- Apply role-based access control before requests reach internal services
- Keep internal service URLs hidden from external clients

Cloud mapping:
In AWS, this component maps to Amazon API Gateway or an Application Load Balancer
fronting ECS/Fargate microservices.
"""

import os
import sys
from typing import Iterable
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import Response

# Import observability utilities (works both locally and in Docker)
services_dir = Path(__file__).parent.parent
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))
from shared_observability import RequestIDMiddleware, get_metrics, setup_structured_logging

app = FastAPI(
    title="AeroLink API Gateway",
    version="1.0.0",
    description="Central routing and authentication gateway for AeroLink microservices.",
)

# Add observability middleware
SERVICE_NAME = "api_gateway"
app.add_middleware(RequestIDMiddleware, service_name=SERVICE_NAME)
logger = setup_structured_logging(SERVICE_NAME)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth_service:8000")
FLIGHT_SERVICE_URL = os.getenv("FLIGHT_SERVICE_URL", "http://flight_service:8000")
BOOKING_SERVICE_URL = os.getenv("BOOKING_SERVICE_URL", "http://booking_service:8000")
BAGGAGE_SERVICE_URL = os.getenv("BAGGAGE_SERVICE_URL", "http://baggage_service:8000")
SCHEDULE_SERVICE_URL = os.getenv("SCHEDULE_SERVICE_URL", "http://schedule_service:8000")

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
}


@app.get("/")
def root():
    return {
        "message": "AeroLink API Gateway is online",
        "public_base_url": "http://localhost:8080",
        "routes": {
            "auth": "/api/auth/*",
            "flights": "/api/flights/*",
            "bookings": "/api/bookings/*",
            "baggage": "/api/baggage/*",
            "schedules": "/api/schedules/*",
        },
    }


@app.get("/metrics")
def metrics_endpoint():
    return get_metrics(SERVICE_NAME)


@app.get("/health")
async def health():
    """Gateway health check plus dependency status for all downstream services."""
    services = {
        "auth_service": f"{AUTH_SERVICE_URL}/health",
        "flight_service": f"{FLIGHT_SERVICE_URL}/health",
        "booking_service": f"{BOOKING_SERVICE_URL}/health",
        "baggage_service": f"{BAGGAGE_SERVICE_URL}/health",
        "schedule_service": f"{SCHEDULE_SERVICE_URL}/health",
    }
    dependencies = {name: "error" for name in services}

    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in services.items():
            try:
                response = await client.get(url)
                dependencies[name] = "ok" if response.status_code == 200 else "error"
            except httpx.HTTPError:
                dependencies[name] = "error"

    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "dependencies": {
            **dependencies,
            "rabbitmq": "not_configured",
        },
    }


async def verify_user(request: Request) -> dict:
    """Validate the Bearer token using the Auth Service /verify endpoint."""
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token. Login first and send Authorization: Bearer <token>.",
        )

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(
            f"{AUTH_SERVICE_URL}/verify",
            headers={"Authorization": authorization},
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return response.json()


def require_roles(user: dict, allowed_roles: Iterable[str]) -> None:
    role = user.get("role")
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required role: {', '.join(allowed_roles)}",
        )


def clean_headers(headers: dict) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in HOP_BY_HOP_HEADERS and k.lower() != "host"}


async def proxy_request(request: Request, base_url: str, target_path: str) -> Response:
    """Forward the incoming request to an internal service and return its response."""
    body = await request.body()
    headers = clean_headers(dict(request.headers))

    async with httpx.AsyncClient(timeout=15.0) as client:
        upstream_response = await client.request(
            method=request.method,
            url=f"{base_url}{target_path}",
            params=request.query_params,
            content=body,
            headers=headers,
        )

    response_headers = clean_headers(dict(upstream_response.headers))
    media_type = upstream_response.headers.get("content-type")
    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers=response_headers,
        media_type=media_type,
    )


# ── AUTH ROUTES ──────────────────────────────────────────────────────────────
@app.api_route("/api/auth", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_proxy(request: Request, path: str = ""):
    # Public endpoints: register and login. Other auth endpoints such as /users/me
    # are protected by the Auth Service itself.
    target_path = f"/{path}" if path else "/"
    return await proxy_request(request, AUTH_SERVICE_URL, target_path)


# ── FLIGHT ROUTES ────────────────────────────────────────────────────────────
@app.api_route("/api/flights", methods=["GET", "POST"])
@app.api_route("/api/flights/{path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def flight_proxy(request: Request, path: str = ""):
    user = await verify_user(request)

    # RBAC: passengers can view flights, but only staff/admin can create or modify them.
    if request.method == "GET":
        require_roles(user, ["passenger", "staff", "admin"])
    elif request.method in ["POST", "PATCH", "DELETE"]:
        require_roles(user, ["staff", "admin"])

    target_path = "/flights" + (f"/{path}" if path else "")
    return await proxy_request(request, FLIGHT_SERVICE_URL, target_path)


# ── BOOKING ROUTES ───────────────────────────────────────────────────────────
@app.api_route("/api/bookings", methods=["GET", "POST"])
@app.api_route("/api/bookings/{path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def booking_proxy(request: Request, path: str = ""):
    user = await verify_user(request)

    # Passengers can create/view their booking requests. Staff/admin are allowed for support.
    if request.method in ["GET", "POST"]:
        require_roles(user, ["passenger", "staff", "admin"])
    elif request.method in ["PATCH", "DELETE"]:
        require_roles(user, ["staff", "admin"])

    target_path = "/bookings" + (f"/{path}" if path else "")
    return await proxy_request(request, BOOKING_SERVICE_URL, target_path)


# ── BAGGAGE ROUTES ───────────────────────────────────────────────────────────
@app.api_route("/api/baggage", methods=["GET", "POST"])
@app.api_route("/api/baggage/{path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def baggage_proxy(request: Request, path: str = ""):
    user = await verify_user(request)

    # Passengers can view their baggage. Staff/admin can create and update baggage.
    if request.method == "GET":
        require_roles(user, ["passenger", "staff", "admin"])
    elif request.method in ["POST", "PATCH", "DELETE"]:
        require_roles(user, ["staff", "admin"])

    target_path = "/baggage" + (f"/{path}" if path else "")
    return await proxy_request(request, BAGGAGE_SERVICE_URL, target_path)


# ── SCHEDULE ROUTES ──────────────────────────────────────────────────────────
@app.api_route("/api/schedules", methods=["GET", "POST"])
@app.api_route("/api/schedules/{path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def schedule_proxy(request: Request, path: str = ""):
    user = await verify_user(request)

    # Passengers can view schedules. Staff/admin can create and update schedules.
    if request.method == "GET":
        require_roles(user, ["passenger", "staff", "admin"])
    elif request.method in ["POST", "PATCH", "DELETE"]:
        require_roles(user, ["staff", "admin"])

    target_path = "/schedules" + (f"/{path}" if path else "")
    return await proxy_request(request, SCHEDULE_SERVICE_URL, target_path)
