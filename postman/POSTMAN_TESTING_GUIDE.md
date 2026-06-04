# AeroLink Distributed API Postman Testing Guide

This guide describes how to configure and execute the API testing collection for the AeroLink Cloud Platform using Postman.

## 1. Import Instructions
1. Open Postman.
2. Click **Import** in the top-left corner.
3. Select and import the following two files from this `postman` directory:
   * `AeroLink_Distributed_API_Testing.postman_collection.json`
   * `AeroLink_Cloud_Testing.postman_environment.json`
4. In the top-right corner, ensure the environment dropdown is set to **AeroLink Cloud Testing**.

## 2. Environment Configuration
Before executing any requests, you must configure the following blank variables in the imported Postman environment:

* `baseUrl`: Your deployed API Gateway endpoint (e.g., `http://aerolink-lb-1234.us-east-1.elb.amazonaws.com`).
* `passengerToken`: A valid JWT access token for a Passenger.
* `staffToken`: A valid JWT access token for a Staff user.

**Important Security Warning:**
Do NOT paste real production tokens, real AWS account details, or hardcoded passwords into the environment file JSON itself. Only paste tokens into the Postman application locally. Tokens must **never** appear in assignment report screenshots.

## 3. Safely Obtaining Fresh Tokens
To obtain fresh tokens without exposing user credentials:
1. Open the already working AeroLink frontend application in your browser.
2. Log in as a Passenger.
3. Open your browser's Developer Tools (F12) -> Application tab -> Local Storage.
4. Locate the Cognito access token, copy it, and paste it into the `passengerToken` field in Postman.
5. Log out, then log in as a Staff user.
6. Copy the new Cognito access token and paste it into the `staffToken` field in Postman.
7. Save the environment in Postman.

## 4. Execution Order
Execute the collection folders strictly from top to bottom. The collection uses pre-request scripts and test scripts to automatically pass identifiers (like `flightId` and `bookingIdSuccess`) between requests. 

* 00 - Pre-Run Validation
* 01 - Authentication and RBAC
* 02 - Flight Management
* 03 - Successful Booking and Payment Flow
* 04 - Failed Payment Flow
* 05 - Staff Booking and Baggage Operations
* 06 - Passenger Notification and Baggage Tracking
* 07 - Optional Pricing or Schedule Synchronisation

You can run the entire collection at once using the **Collection Runner**, or execute each request manually in order.

### Handling Asynchronous Notification Testing
The Passenger Notifications test (`Request API-18`) verifies if the payment success event successfully triggered an asynchronous EventBridge/Lambda workflow. 
* Run the collection once.
* If only the notification test fails due to asynchronous delay, wait approximately 5–10 seconds and rerun `Request API-18` manually.
* Capture the successful rerun as notification synchronisation evidence.

### Pricing vs Schedule Synchronisation Evidence
* This collection demonstrates flight pricing synchronisation.
* Flight schedule synchronisation must be tested separately only if an active implemented schedule-update workflow is available.
* Do not claim that schedule-update testing was completed from the price-update test alone.

## 5. Required Evidence Screenshots
For your COMP60010 assignment report, capture the following screenshots. Ensure no tokens are visible in the request headers or console logs.

1. **Collection Runner Summary**: Showing the overall pass/fail test results.
2. **Request API-01**: `401 Unauthorized` for a no-token request.
3. **Request API-03**: `403 Forbidden` for a Passenger attempting a Staff action (creating a flight).
4. **Request API-04**: Staff successfully creating a flight.
5. **Request API-06**: Passenger creating a booking, resulting in `PENDING_PAYMENT`.
6. **Request API-06B**: Verification of seat availability reduction.
7. **Request API-09 & API-10**: Successful simulated payment followed by a `CONFIRMED` booking status.
8. **Request API-14**: Staff viewing all passenger bookings.
9. **Request API-16 & API-17**: Staff registering baggage and updating its status.
10. **Request API-19**: Passenger successfully retrieving own baggage.
11. **Request API-18**: Passenger notifications retrieval showing payment confirmation (after any asynchronous delay).

## 6. Test Results Matrix Template
Use this blank table format in your assignment report to summarize the outcomes of the Postman tests.

| Test ID | Endpoint | Role | Expected Status | Actual Status | Result |
|---|---|---|---|---|---|
| 00.1 | `GET /health` | None | 200 | | |
| API-01 | `GET /api/flights` | None | 401 | | |
| API-02 | `GET /api/flights` | Passenger | 200 | | |
| API-03 | `POST /api/flights` | Passenger | 403 | | |
| API-04 | `POST /api/flights` | Staff | 200/201 | | |
| API-05 | `GET /api/flights` | Passenger | 200 | | |
| API-06 | `POST /api/bookings` | Passenger | 200/201 | | |
| API-06B| `GET /api/flights` | Passenger | 200 | | |
| API-07 | `GET /api/bookings/me` | Passenger | 200 | | |
| API-08 | `GET /api/bookings` | Passenger | 403 | | |
| API-09 | `POST /api/payments` | Passenger | 200/201 | | |
| API-10 | `GET /api/bookings/me` | Passenger | 200 | | |
| API-11 | `POST /api/bookings` | Passenger | 200/201 | | |
| API-12 | `POST /api/payments` | Passenger | 200/201 | | |
| API-13 | `GET /api/bookings/me` | Passenger | 200 | | |
| API-14 | `GET /api/bookings` | Staff | 200 | | |
| API-15 | `POST /api/baggage` | Passenger | 403 | | |
| API-16 | `POST /api/baggage` | Staff | 200/201 | | |
| API-17 | `PATCH /api/baggage/{id}/status`| Staff | 200 | | |
| API-18 | `GET /api/notifications/me`| Passenger | 200 | | |
| API-19 | `GET /api/baggage/me` | Passenger | 200 | | |
| API-20 | `PATCH /api/baggage/{id}/status`| Passenger | 403 | | |
| API-21 | `PATCH /api/flights/{id}/price` | Staff | 200 | | |
| API-22 | `GET /api/flights` | Passenger | 200 | | |
