# Dummy Payment Implementation

This workspace now includes a **local-only dummy payment service** under `services/payment_service/`.

## Scope

- FastAPI service with in-memory-safe payment fields only.
- No card number, CVV, expiry date, passwords, or tokens are accepted or stored.
- Booking status is updated directly through the local booking service.
- No EventBridge or AWS resource changes are included.

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
  "payment_method": "CARD",
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