# AeroLink Phase 4: Monitoring and Observability

## Overview

Phase 4 introduces lightweight local observability to the AeroLink microservices platform without breaking existing APIs. This enables distributed tracing, structured logging, health monitoring, and metrics collection—all foundational for cloud-native deployments.

## Features Implemented

### 1. Request ID Middleware

Every FastAPI service includes a `RequestIDMiddleware` that:
- Generates a unique UUID for each request if `X-Request-ID` header is not provided
- Returns `X-Request-ID` in all responses for request tracking across services
- Logs HTTP method, path, status code, and duration in milliseconds
- Enables distributed tracing across microservices

**Example request/response:**
```bash
curl -H "X-Request-ID: my-trace-id-123" http://localhost:8080/health
# Response includes: X-Request-ID: my-trace-id-123
```

### 2. Structured Logging

All services use Python's `logging` module with a consistent format:
```
%(asctime)s [%(service_name)s] [%(request_id)s] %(levelname)s - %(message)s
```

**Example log output:**
```
2026-05-10 14:22:31 [flight_service] [550e8400-e29b-41d4-a716-446655440000] INFO - method=POST path=/flights status=201 duration_ms=45.23
```

**Benefits:**
- Easy parsing in log aggregation systems (ELK, Splunk, CloudWatch)
- Request IDs visible in logs for correlation
- Service name and severity included for filtering
- Duration metrics for performance analysis

### 3. Improved Health Endpoints

Each service's `/health` endpoint now returns:
```json
{
  "status": "ok",
  "service": "flight_service",
  "timestamp": "2026-05-10T14:22:31.123Z",
  "dependencies": {
    "database": "ok",
    "rabbitmq": "not_configured"
  }
}
```

**Benefits:**
- Load balancers can monitor service health more precisely
- Dependency status helps diagnose cascading failures
- RabbitMQ services return `"not_configured"` rather than failing

The API Gateway health endpoint also checks downstream service health for `auth_service`, `flight_service`, `booking_service`, `baggage_service`, and `schedule_service` so you can verify the full request path from one place.

### 4. Metrics Endpoints

Each service exposes a `/metrics` endpoint with in-memory counters:
```json
{
  "service": "flight_service",
  "requests_total": 152,
  "errors_total": 3,
  "uptime_seconds": 3245.67
}
```

**Benefits:**
- Simple baseline for performance monitoring
- Track error rates and uptime
- Foundation for alerting (e.g., alert if `errors_total` grows rapidly)

These counters are intentionally in-memory for the local prototype. In AWS, they map cleanly to CloudWatch custom metrics or a Prometheus-style exporter later without changing the API shape.

### 5. Event Consumer Logging

The event consumer now logs every consumed event with enhanced information:
```
2026-05-10 14:22:31 [EVENT_CONSUMER] INFO - ━━━ Consumed Event: event_type=PRICE_UPDATED timestamp=2026-05-10T14:22:31.000Z ━━━
2026-05-10 14:22:31 [EVENT_CONSUMER] INFO -   Payload summary: {"flight_id": 1, "new_price": 550.00}...
2026-05-10 14:22:31 [EVENT_CONSUMER] INFO - ✓ Event 'PRICE_UPDATED' processed and acknowledged.
```

**Benefits:**
- Complete audit trail of all events processed
- Timestamp for each event helps correlate with other systems
- Payload summaries aid in debugging event-driven workflows
- Connection failures logged clearly for troubleshooting RabbitMQ issues

## Cloud Mapping

| Local Feature | AWS Equivalent | Purpose |
|---|---|---|
| `X-Request-ID` header | `X-Amzn-Trace-Id` / `X-Ray` | Distributed tracing across services |
| Structured logs (stdout) | CloudWatch Logs | Centralized log aggregation |
| `/health` endpoints | Load Balancer target groups | Health checks for auto-scaling |
| `/metrics` endpoints | CloudWatch custom metrics | Application performance monitoring |
| Request duration logs | CloudWatch Insights queries | Performance analysis and bottleneck detection |
| Event consumer logs | CloudWatch Logs | Event processing audit trail |

### Example: AWS Architecture

In AWS, you would:
1. **Redirect stdout/stderr** to CloudWatch Logs using ECS task definitions
2. **Configure Load Balancer** to call `/health` endpoints every 5-10 seconds
3. **Set up CloudWatch Alarms** on `/metrics` endpoints (e.g., if `errors_total` exceeds threshold)
4. **Enable X-Ray** to visualize request traces using the `X-Request-ID` header
5. **Run CloudWatch Insights queries** to analyze performance patterns

## Local Development and Testing

### Health Checks

Check service health locally:
```bash
curl http://localhost:8000/health                # Individual service
curl http://localhost:8080/health                # API Gateway
```

### Metrics

View current service metrics:
```bash
curl http://localhost:8000/metrics               # Individual service
curl http://localhost:8080/metrics               # API Gateway
```

### Docker Logs with Service Names

View logs from all services:
```bash
docker-compose logs -f                           # Follow all services
docker-compose logs -f flight_service            # Single service
docker-compose logs -f auth_service booking_service  # Multiple services
```

### Request Tracing

Test request ID propagation:
```powershell
# Generate request with custom trace ID
curl.exe -H "X-Request-ID: custom-trace-123" http://localhost:8080/api/flights

# Check response headers
curl.exe -i http://localhost:8080/api/flights | Select-String X-Request-ID
```

### Integration Test Output

The integration test (`tests/test_gateway_integration.py`) logs all requests with request IDs. Inspect logs during test runs:
```powershell
Start-Process docker-compose -ArgumentList 'up --build' -NoNewWindow
Start-Sleep -Seconds 5
python -m pytest tests/test_gateway_integration.py -v -s
docker-compose down
```

## Screenshots to Capture for Evidence

### Phase 4 Observability Evidence:
1. **Health Checks:**
   - `curl http://localhost:8080/health` showing all services healthy with dependency status

2. **Metrics:**
   - `curl http://localhost:8080/metrics` showing request counts, errors, and uptime

3. **Structured Logs:**
   - `docker-compose logs -f flight_service` showing structured logs with request IDs and durations
   - Event consumer logs showing `PRICE_UPDATED`, `BAGGAGE_STATUS_UPDATED`, `FLIGHT_SCHEDULE_UPDATED` events with timestamps

4. **Request Tracing:**
   - Request with custom `X-Request-ID` header and corresponding log entries showing the trace ID

5. **Performance:**
   - Metrics endpoint showing uptime and request throughput over time

## Performance Considerations

- **Request ID Middleware:** Adds ~1-2ms per request (UUID generation, header extraction)
- **Logging:** Synchronous to file/stdout; async logging not implemented (see improvements below)
- **Metrics:** In-memory counters; no storage overhead
- **Health Checks:** Simple database pings; no heavy operations

**For high-traffic systems in production:**
- Consider async logging (e.g., `python-json-logger` with async handlers)
- Use Prometheus for metrics instead of JSON endpoints
- Implement sampling for high-volume tracing (e.g., 10% of requests)
- Cache health check results to reduce database load

## Future Improvements

1. **Prometheus Integration:** Add `prometheus_client` for standard metrics format
2. **Async Logging:** Use `aiologging` or `structlog` for async log writes
3. **Distributed Tracing:** Integrate with Jaeger or Zipkin using OpenTelemetry
4. **Log Sampling:** Sample verbose logs in high-traffic scenarios
5. **Custom Metrics:** Add business metrics (e.g., bookings per minute, seat utilization)
6. **Alert Rules:** Define thresholds for automated alerting (e.g., error rate > 5%)

## Testing

All tests pass with observability middleware enabled:
```bash
# Unit tests (mocked services)
python -m pytest tests -m unit -v

# Integration tests (full Docker stack)
docker-compose up --build
python -m pytest tests -m integration -v

# All tests
python -m pytest tests -q
```

Tests are not affected because:
- Middleware does not modify request/response payloads
- Health and metrics endpoints are separate from business logic routes
- Event consumer logging is informational and doesn't affect message processing
- TestClient automatically captures request IDs

## References

- **12-Factor App - Logs:** https://12factor.net/logs
- **AWS CloudWatch Logs:** https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/
- **AWS X-Ray:** https://docs.aws.amazon.com/xray/latest/devguide/
- **OpenTelemetry:** https://opentelemetry.io/
- **Structured Logging Best Practices:** https://www.kartar.net/2015/12/structured-logging/
