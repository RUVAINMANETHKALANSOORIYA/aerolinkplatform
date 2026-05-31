# Cognito Authentication

This document describes the Cognito-based authentication and RBAC used by the ECS/FastAPI `api_gateway` service only. The Lambda/serverless implementation is unchanged.

## Cognito setup

- AWS Region: `us-east-1`
- Cognito User Pool ID: `us-east-1_hpW84ZtH4`
- Cognito App Client ID: `14hg3aomr5krmmac2ivh7q25bv`
- Cognito issuer: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hpW84ZtH4`
- Cognito groups: `Passenger` and `Staff`

## JWT validation flow

1. The gateway reads the `Authorization: Bearer <token>` header.
2. It fetches the Cognito JWKS from the user pool's `.well-known/jwks.json` endpoint.
3. The JWT signature is verified with the RS256 public key that matches the token `kid`.
4. The gateway verifies token expiry using the JWT library.
5. The issuer must match the configured Cognito issuer.
6. The token must be an access token (`token_use=access`).
7. The token `client_id` must match the configured Cognito App Client ID.
8. The gateway reads `cognito:groups` and applies route-level RBAC.

## Passenger vs Staff permissions

Passenger:

- `GET /api/flights`
- `GET /api/schedules`
- `POST /api/bookings`
- `GET /api/bookings`
- `GET /api/baggage`

Staff:

- `GET /api/flights`
- `POST /api/flights`
- `PATCH /api/flights/{path}`
- `PUT /api/flights/{path}`
- `DELETE /api/flights/{path}`
- `GET /api/bookings`
- `GET /api/baggage`
- `POST /api/baggage`
- `PATCH /api/baggage/{path}`
- `PUT /api/baggage/{path}`
- `DELETE /api/baggage/{path}`
- `GET /api/schedules`
- `POST /api/schedules`
- `PATCH /api/schedules/{path}`
- `PUT /api/schedules/{path}`
- `DELETE /api/schedules/{path}`

Public endpoints remain:

- `GET /health`
- `GET /metrics`
- `GET /`
- FastAPI docs endpoints when enabled: `/docs`, `/redoc`, `/openapi.json`

## Environment variables

Required for the ECS/FastAPI gateway:

- `AWS_REGION=us-east-1`
- `COGNITO_USER_POOL_ID=us-east-1_hpW84ZtH4`
- `COGNITO_APP_CLIENT_ID=14hg3aomr5krmmac2ivh7q25bv`
- `COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hpW84ZtH4`

Existing service routing variables remain unchanged:

- `PUBLIC_BASE_URL`
- `AUTH_SERVICE_URL`
- `FLIGHT_SERVICE_URL`
- `BOOKING_SERVICE_URL`
- `BAGGAGE_SERVICE_URL`
- `SCHEDULE_SERVICE_URL`

For local Docker Compose, these values can be supplied through a `.env` file in the repository root.

## Postman testing steps

1. Sign in to Cognito as a Passenger or Staff test user and copy the access token from the authentication response.
2. Create a Postman environment variable named `access_token`.
3. Add the header `Authorization: Bearer {{access_token}}` to authenticated requests.
4. Call `GET http://localhost:8080/health` without a token to confirm it stays public.
5. Call `GET http://localhost:8080/api/flights` with a Passenger token and confirm access is allowed.
6. Call `POST http://localhost:8080/api/flights` with a Passenger token and confirm the gateway returns `403 Forbidden`.
7. Call `POST http://localhost:8080/api/bookings` with a Passenger token and confirm access is allowed.
8. Call `GET http://localhost:8080/api/bookings` with a Staff token and confirm access is allowed.
9. Call `POST http://localhost:8080/api/baggage` with a Staff token and confirm access is allowed.
10. Call `GET http://localhost:8080/api/schedules` with a Passenger token and confirm access is allowed.

Suggested assertions:

- Public endpoints return `200` without authentication.
- Passenger write attempts to staff-only routes return `403`.
- Valid Passenger and Staff access tokens return `200` or the downstream service's expected success status.

## Screenshot evidence list

- API Gateway health check success with no auth header.
- Passenger token request to `GET /api/flights`.
- Passenger blocked response for `POST /api/flights`.
- Passenger allowed response for `POST /api/bookings`.
- Staff allowed response for `POST /api/flights`.
- Staff allowed response for `POST /api/baggage`.
- Staff allowed response for `POST /api/schedules`.
- Postman request showing the Cognito access token header.
- ECS task definition showing the Cognito environment variables.