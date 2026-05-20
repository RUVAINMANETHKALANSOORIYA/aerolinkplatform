# Phase 1 - API Gateway and RBAC Upgrade

## What was added

This phase adds a new `api_gateway` microservice.

The gateway gives the project a single public entry point:

```text
http://localhost:8080
```

It routes requests to internal services:

```text
/api/auth/*     -> auth_service
/api/flights/*  -> flight_service
/api/bookings/* -> booking_service
```

## Security improvement

The gateway validates JWT tokens by calling:

```text
auth_service /verify
```

It also applies role-based access control:

| Action | Passenger | Staff | Admin |
|---|---:|---:|---:|
| Register/login | Yes | Yes | Yes |
| View flights | Yes | Yes | Yes |
| Create flights | No | Yes | Yes |
| Update flight price | No | Yes | Yes |
| Create booking | Yes | Yes | Yes |
| Modify/delete booking | No | Yes | Yes |

## Why this matters for the assignment

The assignment asks for a distributed web application that includes:

- API Gateway for routing and authentication
- API documentation
- secure service-to-service communication
- authentication, authorisation, JWT, and RBAC

This phase directly supports those requirements.

## Screenshots to collect

1. Docker containers running.
2. API Gateway Swagger UI at `http://localhost:8080/docs`.
3. Login returning a JWT token.
4. Request without token returning `401 Unauthorized`.
5. Passenger attempting to create flight returning `403 Forbidden`.
6. Staff/admin creating a flight successfully.
7. Passenger creating a booking successfully.
