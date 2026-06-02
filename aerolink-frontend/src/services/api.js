/**
 * services/api.js
 *
 * Centralised HTTP client for the AeroLink ECS backend.
 * Reads API_BASE_URL from config.js (sourced from VITE_API_BASE_URL env var).
 * Attaches the Cognito access token from localStorage as Authorization: Bearer.
 *
 * No URLs, IDs or secrets are hardcoded here.
 */
import { API_BASE_URL } from "../config.js";

async function requestJson(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };

  // Attach Cognito access token when present
  try {
    const token = localStorage.getItem("token");
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
  const data = rawBody ? JSON.parse(rawBody) : {};

  if (!response.ok) {
    console.error("API error", { url, status: response.status, data });
    throw new Error(data?.detail || data?.message || `Request failed (${response.status})`);
  }

  return data;
}

// ── Public endpoints ──────────────────────────────────────────────────────────

export const getHealth = () => requestJson("/health");

// ── Flights ───────────────────────────────────────────────────────────────────

export const getFlights = () => requestJson("/api/flights");

export const createFlight = (payload) =>
  requestJson("/api/flights", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ── Bookings ──────────────────────────────────────────────────────────────────

export const getBookings = () => requestJson("/api/bookings");

export const createBooking = (payload) =>
  requestJson("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ── Baggage ───────────────────────────────────────────────────────────────────

export const getBaggage = () => requestJson("/api/baggage");

export const updateBaggageStatus = (baggageId, status) =>
  requestJson(`/api/baggage/${baggageId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// NOTE: /api/notifications is not yet deployed. Do not call it from the frontend.
