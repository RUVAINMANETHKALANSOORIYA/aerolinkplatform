/**
 * services/api.js
 *
 * Centralised HTTP client for the AeroLink ECS backend.
 * Reads API_BASE_URL from config.js (sourced from VITE_API_BASE_URL env var).
 * Attaches the Cognito access token using the auth helper.
 *
 * No URLs, IDs or secrets are hardcoded here.
 */
import { API_BASE_URL } from "../config.js";
import { getStoredAccessToken } from "../auth.js";

async function requestJson(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };

  // Attach Cognito access token when present
  try {
    const token = getStoredAccessToken();
    if (token && !headers.Authorization && !headers.authorization) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // ignore localStorage errors in restricted environments
  }

  if (options.body && !(headers["Content-Type"] || headers["content-type"])) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { headers, ...options });
  const rawBody = await response.text();
  let data = {};
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = { message: rawBody };
    }
  }

  if (!response.ok) {
    console.error("API error", { url, status: response.status, data });
    // Friendly error rendering from FastAPI shapes
    let errorMsg = `Request failed (${response.status})`;
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        // Validation errors usually look like: [{ loc: ["query", "flight_no"], msg: "field required" }]
        errorMsg = data.detail.map(e => `${e.loc?.slice(-1)[0] || 'Field'}: ${e.msg}`).join(", ");
      } else if (typeof data.detail === "string") {
        errorMsg = data.detail;
      }
    } else if (data?.message) {
      errorMsg = data.message;
    }
    throw new Error(errorMsg);
  }

  return data;
}

// ── Public endpoints ──────────────────────────────────────────────────────────

export const getHealth = () => requestJson("/health");

// ── Flights ───────────────────────────────────────────────────────────────────

export const getFlights = () => requestJson("/api/flights");

export const createFlight = (flight_no, origin, destination, price, seats) =>
  requestJson(`/api/flights?flight_no=${encodeURIComponent(flight_no)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&price=${encodeURIComponent(price)}&seats=${encodeURIComponent(seats)}`, {
    method: "POST"
  });

export const updateFlightPrice = (flight_id, newPrice) =>
  requestJson(`/api/flights/${encodeURIComponent(flight_id)}/price?new_price=${encodeURIComponent(newPrice)}`, {
    method: "PATCH"
  });

export const updateFlightRoute = (flight_id, origin, destination) =>
  requestJson(`/api/flights/${encodeURIComponent(flight_id)}/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`, {
    method: "PATCH"
  });

// ── Bookings ──────────────────────────────────────────────────────────────────

export const getBookings = (isPassenger = true) => requestJson(isPassenger ? "/api/bookings/me" : "/api/bookings");

export const createBooking = (name, flight_id, seat_count) =>
  requestJson(`/api/bookings?name=${encodeURIComponent(name)}&flight_id=${encodeURIComponent(flight_id)}&seat_count=${encodeURIComponent(seat_count)}`, {
    method: "POST"
  });

// ── Baggage ───────────────────────────────────────────────────────────────────

export const getMyBaggage = () => requestJson("/api/baggage/me");

export const getAllBaggage = () => requestJson("/api/baggage");

export const createBaggage = (bookingId, tagNumber, weightKg) => {
  const parsedWeight = parseFloat(weightKg);
  return requestJson("/api/baggage", {
    method: "POST",
    body: JSON.stringify({
      booking_id: bookingId,
      tag_number: tagNumber,
      weight_kg: isNaN(parsedWeight) ? null : parsedWeight
    }),
  });
};

export const updateBaggageStatus = (baggageId, status) =>
  requestJson(`/api/baggage/${encodeURIComponent(baggageId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// ── Payments ──────────────────────────────────────────────────────────────────

export const createPayment = (bookingId, result) =>
  requestJson("/api/payments", {
    method: "POST",
    body: JSON.stringify({
      booking_id: bookingId,
      payment_result: result
    })
  });

// ── Notifications ─────────────────────────────────────────────────────────────

export const getMyNotifications = () =>
  requestJson("/api/notifications/me", {
    method: "GET"
  });


