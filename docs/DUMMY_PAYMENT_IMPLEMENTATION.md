# Dummy Payment Implementation

This workspace now includes a **dummy payment service** under `services/payment_service/`.

## Scope

- FastAPI service with in-memory-safe payment fields only.
- No card number, CVV, expiry date, passwords, bank credentials, or real payment data are accepted or stored.
- Booking status is updated directly through the local booking service in SQLite mode.
- DynamoDB support is implemented in code for AWS mode, but ECS deployment is not yet complete.
- EventBridge notifications are still pending.

## Local Docker Defaults

Local Docker development uses SQLite by default.

- `BOOKING_STORAGE_BACKEND=sqlite`
- `PAYMENT_STORAGE_BACKEND=sqlite`
- `PAYMENT_SERVICE_URL=http://payment_service:8000`

## Endpoints

- `POST /payments`
- `GET /payments/{payment_id}`
- `GET /payments/booking/{booking_id}`
- `GET /payments` is exposed for Staff through the gateway.

## Payment Flow

Accepted request body fields:

- `booking_id`
- `amount`
- `payment_method`
- `payment_result`

Stored fields:

- `id`
- `booking_id`
- `amount`
- `payment_method`
- `payment_status`
- `transaction_reference`
- `created_at`

Behavior:

- `payment_result=SUCCESS` creates a payment and updates the booking to `CONFIRMED`.
- `payment_result=FAILED` creates a payment and updates the booking to `PAYMENT_FAILED`.
- `payment_result=PENDING` creates a payment without changing the booking.

## Local Docker Compose

Start or rebuild the stack:

```bash
docker compose down
docker compose up --build -d
docker compose ps
```

The gateway now proxies payment routes with `PAYMENT_SERVICE_URL=http://payment_service:8000` inside Docker.

## Postman Tests

Use the API gateway base URL: `http://localhost:8080`

### Passenger create payment

- Method: `POST`
- URL: `/api/payments`
- Headers: `Authorization: Bearer <passenger_access_token>`
- Body:

```json
{
  "booking_id": 1,
  "amount": 125.50,
  "payment_method": "SIMULATED_CARD",
  "payment_result": "SUCCESS"
}
```

Expected:

- `201 Created`
- `payment_status` is `SUCCESS`
- booking status becomes `CONFIRMED`

### Passenger blocked from staff list view

- Method: `GET`
- URL: `/api/payments`
- Headers: `Authorization: Bearer <passenger_access_token>`

Expected:

- `403 Forbidden`

### Staff list payments

- Method: `GET`
- URL: `/api/payments`
- Headers: `Authorization: Bearer <staff_access_token>`

Expected:

- `200 OK`

### Staff view payment by id

- Method: `GET`
- URL: `/api/payments/{payment_id}`
- Headers: `Authorization: Bearer <staff_access_token>`

Expected:

- `200 OK`

### Payment lookup by booking

- Method: `GET`
- URL: `/api/payments/booking/{booking_id}`
- Headers: `Authorization: Bearer <staff_access_token>` or passenger token for prototype testing

Expected:

- `200 OK`

## Database Reset / Migration Notes

This implementation uses SQLite locally for the dummy service.

- Delete `services/payment_service/payment.db` if you want a clean local reset.
- Delete `services/booking_service/bookings.db` if you want booking statuses reset too.
- No formal migration tool was added.
- `Base.metadata.create_all(...)` creates the new payment table on startup.

If you already have a running container with an older schema, rebuild the service or remove the SQLite file so the new columns are created fresh.

## AWS ECS Persistence

AWS ECS Fargate mode uses DynamoDB for durable persistence.

- Booking Service: `BOOKING_STORAGE_BACKEND=dynamodb`
- Booking table: `AeroLinkBookings`
- Payment Service: `PAYMENT_STORAGE_BACKEND=dynamodb`
- Payment table: `AeroLinkPayments`
- AWS Region: `us-east-1`

Schema notes:

- `AeroLinkBookings` uses String `booking_id` values in DynamoDB mode.
- `AeroLinkPayments` uses String `payment_id` values.
- Local SQLite integer booking IDs are only for local testing and are not interchangeable with AWS UUID booking IDs.

Current deployment status:

- DynamoDB support is implemented and mock-tested in code.
- The Payment Service has not yet been deployed to ECS Fargate.
- Live ALB-to-ECS-to-DynamoDB payment evidence is still pending.
- EventBridge notification publishing is implemented in local code (see section below).

---

## EventBridge Payment Notifications

### Local Code Status

EventBridge-based payment notification publishing is now **implemented in local code** as of this milestone.

Changes made:

- `services/payment_service/main.py` — `publish_payment_event()` is called after every
  successful payment record write **and** booking status update.
- `services/payment_notification_lambda/lambda_function.py` — new dedicated Lambda handler
  that receives EventBridge events and stores `UNREAD` notifications in `AeroLinkNotifications`.
- `docker-compose.yml` — `PAYMENT_EVENTS_ENABLED: "false"` is set for the local
  `payment_service` container so no real AWS EventBridge calls are ever made during
  local development or Docker testing.

### AWS Deployment Status

> **Not yet completed or evidenced.**
>
> The EventBridge rule, Lambda trigger, and `AeroLinkNotifications` DynamoDB table have
> **not yet been deployed** to AWS. No live AWS EventBridge events have been produced or
> consumed by this service. Deployment of this flow remains a future milestone.

### Planned Deployed Flow

```
Payment Service (ECS Fargate)
    │  PUT event (PAYMENT_EVENTS_ENABLED=true)
    ▼
EventBridge default bus
    │  Rule: source = "aerolink.payment"
    │         detail-type IN ["PaymentSucceeded", "PaymentFailed"]
    ▼
Payment Notification Lambda
    │  lambda_handler(event, context)
    ▼
AeroLinkNotifications (DynamoDB)
    notification_status = "UNREAD"
```

### Event Types

| detail-type        | Trigger condition                | Notification title      |
|--------------------|----------------------------------|-------------------------|
| `PaymentSucceeded` | `payment_result=SUCCESS`         | Payment confirmed       |
| `PaymentFailed`    | `payment_result=FAILED`          | Payment unsuccessful    |

### EventBridge Event Detail Payload

Only the following fields are published. No sensitive data is included.

```json
{
  "payment_id": "<uuid>",
  "booking_id": "<booking-id>",
  "payment_status": "SUCCESS | FAILED",
  "booking_status": "CONFIRMED | PAYMENT_FAILED",
  "transaction_reference": "PAY-...",
  "created_at": "<ISO-8601 timestamp>"
}
```

### Privacy and Security Guarantee

No real card numbers, CVV codes, expiry dates, banking credentials, access tokens,
passwords or any other sensitive payment instrument data are accepted, stored,
or published at any stage of this payment flow — including in EventBridge events,
DynamoDB records, Lambda handlers or API responses.

The `payment_method` field accepts only the literal string `SIMULATED_CARD`.
The `payment_result` field accepts only `SUCCESS`, `FAILED`, or `PENDING`.