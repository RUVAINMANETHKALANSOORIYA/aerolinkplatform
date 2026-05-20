"""
Shared observability utilities for AeroLink microservices.

Provides:
- Structured logging configuration
- Request ID middleware for distributed tracing
- Metrics tracking
- Health check helpers
"""

import logging
import time
import uuid
from contextvars import ContextVar
from datetime import datetime
from threading import Lock
from typing import Optional, Dict, Any

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


# Context variable to store request_id across async contexts
request_id_context: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_metrics_registry: Dict[str, "ServiceMetrics"] = {}
_metrics_registry_lock = Lock()


def setup_structured_logging(service_name: str) -> logging.Logger:
    """Configure structured logging for a microservice."""
    logger = logging.getLogger(service_name)

    if not logger.handlers:
        handler = logging.StreamHandler()

        class ServiceFormatter(logging.Formatter):
            def __init__(self, service_name_val):
                super().__init__()
                self.service_name = service_name_val

            def format(self, record):
                record.service_name = self.service_name
                record.request_id = request_id_context.get() or "N/A"
                fmt = "%(asctime)s [%(service_name)s] [%(request_id)s] %(levelname)s - %(message)s"
                formatter = logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S")
                return formatter.format(record)

        handler.setFormatter(ServiceFormatter(service_name))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger


class ServiceMetrics:
    """Simple in-memory metrics tracker for local prototyping."""

    def __init__(self, service_name: str):
        self.service_name = service_name
        self.requests_total = 0
        self.errors_total = 0
        self.start_time = time.time()
        self._lock = Lock()

    def record_request(self, success: bool = True):
        """Record a request (success or error)."""
        with self._lock:
            self.requests_total += 1
            if not success:
                self.errors_total += 1

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics as a dictionary."""
        with self._lock:
            uptime_seconds = time.time() - self.start_time
            return {
                "service": self.service_name,
                "requests_total": self.requests_total,
                "errors_total": self.errors_total,
                "uptime_seconds": round(uptime_seconds, 2),
            }


def get_metrics_tracker(service_name: str) -> ServiceMetrics:
    """Return the in-memory metrics tracker for a service."""
    with _metrics_registry_lock:
        metrics = _metrics_registry.get(service_name)
        if metrics is None:
            metrics = ServiceMetrics(service_name)
            _metrics_registry[service_name] = metrics
        return metrics


def get_metrics(service_name: str) -> Dict[str, Any]:
    """Return the current metrics snapshot for a service."""
    return get_metrics_tracker(service_name).get_metrics()


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware that generates or extracts request ID and adds it to response headers."""

    def __init__(self, app, service_name: str):
        super().__init__(app)
        self.service_name = service_name
        self.logger = setup_structured_logging(service_name)

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_context.set(request_id)

        request.state.request_id = request_id
        request.state.start_time = time.time()
        metrics = get_metrics_tracker(self.service_name)

        try:
            response = await call_next(request)
            success = response.status_code < 400
        except Exception:
            duration_ms = (time.time() - request.state.start_time) * 1000
            metrics.record_request(success=False)
            self.logger.exception(
                f"method={request.method} path={request.url.path} status_code=500 duration_ms={duration_ms:.2f}"
            )
            response = JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
        else:
            duration_ms = (time.time() - request.state.start_time) * 1000
            metrics.record_request(success=success)
            self.logger.info(
                f"method={request.method} path={request.url.path} "
                f"status_code={response.status_code} duration_ms={duration_ms:.2f}"
            )

        response.headers["X-Request-ID"] = request_id
        return response


class HealthChecker:
    """Helper for health check endpoints with dependency status."""

    def __init__(self, service_name: str):
        self.service_name = service_name

    def check_database(self, db_session) -> str:
        """Check if database is accessible."""
        try:
            if db_session is None:
                return "not_configured"
            db_session.execute(text("SELECT 1"))
            return "ok"
        except Exception:
            return "error"

    def get_health_status(self, db_status: str = "not_configured", rabbitmq_status: str = "not_configured") -> Dict[str, Any]:
        """Get health status with dependencies."""
        return {
            "status": "ok",
            "service": self.service_name,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "dependencies": {
                "database": db_status,
                "rabbitmq": rabbitmq_status,
            },
        }
