import { useState } from "react";
import "./App.css";
import { API_BASE_URL } from "./config.js";
import { cognitoLogin, cognitoLogout } from "./auth.js";

// ── HTTP helper ───────────────────────────────────────────────────────────────
// Reads the Cognito access token from localStorage and sends it as
// Authorization: Bearer <token> on every request that carries a token.

async function requestJson(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    ...(options.headers || {}),
  };

  // Attach Cognito access token when present
  try {
    const token = localStorage.getItem("token");
    if (token && !headers.Authorization && !headers.authorization) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore localStorage errors in restricted environments
  }

  // Add Content-Type for requests with a body
  if (options.body && !(headers["Content-Type"] || headers["content-type"])) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      headers,
      ...options,
    });

    const rawBody = await response.text();
    const data = rawBody ? JSON.parse(rawBody) : {};

    if (!response.ok) {
      console.error("API request failed", {
        url,
        status: response.status,
        statusText: response.statusText,
        response: data,
      });
      throw new Error(data?.detail || data?.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("Fetch error", { url, path, options, error });
    throw error;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [health, setHealth] = useState(null);
  const [auth, setAuth] = useState(() => ({
    token: localStorage.getItem("token") || null,
    username: localStorage.getItem("username") || null,
    role: localStorage.getItem("role") || null,
  }));
  const [flights, setFlights] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [baggage, setBaggage] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [flightId, setFlightId] = useState("");
  const [passengerName, setPassengerName] = useState("Demo Passenger");
  const [baggageId, setBaggageId] = useState("");
  const [baggageStatus, setBaggageStatus] = useState("loaded");
  const [message, setMessage] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Health (public — no auth required) ─────────────────────────────────────
  const checkHealth = async () => {
    try {
      const data = await requestJson("/health");
      setHealth(data.item || data);
      setMessage(data.message || "Health check successful");
    } catch (error) {
      console.error("Health check failed", error);
      setMessage(error.message || "Health check failed");
    }
  };

  // ── Cognito login ──────────────────────────────────────────────────────────
  // Both Passenger and Staff authenticate directly against Cognito.
  // The ECS API Gateway enforces group-based RBAC using the returned access token.

  const login = async (isStaff = false) => {
    const user = isStaff ? staffUsername : loginUsername;
    const pass = isStaff ? staffPassword : loginPassword;

    if (!user || !pass) {
      setMessage("Please enter a username and password.");
      return;
    }

    setLoginLoading(true);
    setMessage("");

    try {
      const result = await cognitoLogin(user, pass);
      setAuth({ token: result.accessToken, username: result.username, role: result.role });
      setMessage(`Signed in as ${result.username} (${result.role})`);
    } catch (error) {
      console.error("Cognito login failed", error);
      setMessage(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    cognitoLogout();
    setAuth({ token: null, username: null, role: null });
    setFlights([]);
    setBookings([]);
    setBaggage([]);
    setNotifications([]);
    setHealth(null);
    setMessage("Signed out.");
  };

  // ── Flights (/api/flights) ─────────────────────────────────────────────────

  const getFlights = async () => {
    try {
      const data = await requestJson("/api/flights");
      setFlights(data.items || []);
      setMessage(data.message || "Flights loaded successfully");
    } catch (error) {
      console.error("Load flights failed", error);
      setMessage(error.message || "Failed to load flights");
    }
  };

  const createFlight = async () => {
    try {
      const data = await requestJson("/api/flights", {
        method: "POST",
        body: JSON.stringify({
          flight_no: "AL-FRONTEND-101",
          origin: "CMB",
          destination: "DXB",
          total_seats: 100,
          price: "320.00",
        }),
      });

      const newFlightId = data.item?.flight_id;

      if (newFlightId) {
        setFlightId(newFlightId);
        setMessage(data.message || `Flight created. ID: ${newFlightId}`);
        getFlights();
      } else {
        setMessage(data.message || "Flight created, but flight ID was not returned");
      }
    } catch (error) {
      console.error("Create flight failed", error);
      setMessage(error.message || "Failed to create flight");
    }
  };

  // ── Bookings (/api/bookings) ───────────────────────────────────────────────

  const createBooking = async () => {
    if (!flightId) {
      setMessage("Please create or enter a flight ID first");
      return;
    }
    try {
      const data = await requestJson("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          flight_id: flightId,
          passenger_name: passengerName,
          seat_count: 1,
        }),
      });
      setMessage(data.message || "Booking created successfully");
      getBookings();
    } catch (error) {
      console.error("Create booking failed", error);
      setMessage(error.message || "Failed to create booking");
    }
  };

  const getBookings = async () => {
    try {
      const data = await requestJson("/api/bookings");
      setBookings(data.items || []);
      setMessage(data.message || "Bookings loaded successfully");
    } catch (error) {
      console.error("Load bookings failed", error);
      setMessage(error.message || "Failed to load bookings");
    }
  };

  // ── Baggage (/api/baggage) ─────────────────────────────────────────────────

  const getBaggage = async () => {
    try {
      const data = await requestJson("/api/baggage");
      setBaggage(data.items || []);
      setMessage(data.message || "Baggage loaded successfully");
    } catch (error) {
      console.error("Load baggage failed", error);
      setMessage(error.message || "Failed to load baggage");
    }
  };

  const updateBaggageStatus = async () => {
    if (!baggageId) {
      setMessage("Please enter a baggage ID first");
      return;
    }
    try {
      const data = await requestJson(`/api/baggage/${baggageId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: baggageStatus }),
      });
      setMessage(data.message || "Baggage status updated successfully");
      getBaggage();
    } catch (error) {
      console.error("Update baggage status failed", error);
      setMessage(error.message || "Failed to update baggage status");
    }
  };

  // ── Notifications (stub — endpoint not yet available on ECS) ───────────────
  // getNotifications is kept but disabled in the UI until the notification_service
  // ECS microservice and /api/notifications gateway route are implemented.
  const getNotifications = async () => {
    try {
      const data = await requestJson("/api/notifications");
      setNotifications(data.items || []);
      setMessage(data.message || "Notifications loaded successfully");
    } catch (error) {
      console.error("Load notifications failed", error);
      setMessage(error.message || "Failed to load notifications");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <header className="hero">
        <p className="tag">AeroLink Airline Systems Platform</p>
        <h1>Cloud-Based Airline Dashboard</h1>
        <p>
          React frontend connected to the AeroLink ECS Fargate backend via the
          Application Load Balancer. Authentication uses Amazon Cognito.
        </p>
      </header>

      <section className="cards">
        {/* ── System Health ── */}
        <div className="card">
          <h2>System Health</h2>
          <button onClick={checkHealth}>Check Health</button>
          {health && (
            <pre>{JSON.stringify(health, null, 2)}</pre>
          )}
        </div>

        {/* ── Authentication ── */}
        <div className="card">
          <h2>Authentication</h2>
          {!auth.token ? (
            <div>
              <div>
                <h4>Passenger Login</h4>
                <input
                  id="passenger-username"
                  placeholder="Cognito username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                />
                <input
                  id="passenger-password"
                  placeholder="Password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  id="passenger-login-btn"
                  onClick={() => login(false)}
                  disabled={loginLoading}
                >
                  {loginLoading ? "Signing in…" : "Passenger Login"}
                </button>
              </div>

              <div>
                <h4>Staff Login</h4>
                <input
                  id="staff-username"
                  placeholder="Cognito username"
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                />
                <input
                  id="staff-password"
                  placeholder="Password"
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                />
                <button
                  id="staff-login-btn"
                  onClick={() => login(true)}
                  disabled={loginLoading}
                >
                  {loginLoading ? "Signing in…" : "Staff Login"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div>
                Signed in as: <strong>{auth.username}</strong> ({auth.role})
              </div>
              <button id="logout-btn" onClick={logout}>
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* ── Flights ── */}
        <div className="card">
          <h2>Flights</h2>
          <div className="actions">
            <button id="create-flight-btn" onClick={createFlight}>Create Flight</button>
            <button id="view-flights-btn" onClick={getFlights}>View Flights</button>
          </div>

          <input
            id="flight-id-input"
            value={flightId}
            onChange={(e) => setFlightId(e.target.value)}
            placeholder="Flight ID for booking"
          />
          <input
            id="passenger-name-input"
            value={passengerName}
            onChange={(e) => setPassengerName(e.target.value)}
            placeholder="Passenger name"
          />

          <div className="list">
            {flights.map((flight) => (
              <div className="item" key={flight.flight_id}>
                <strong>{flight.flight_no}</strong>
                <span>{flight.origin} → {flight.destination}</span>
                <small>ID: {flight.flight_id}</small>
                <small>Available seats: {flight.available_seats}</small>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bookings ── */}
        <div className="card">
          <h2>Bookings</h2>
          <div className="actions">
            <button id="create-booking-btn" onClick={createBooking}>Create Booking</button>
            <button id="view-bookings-btn" onClick={getBookings}>View Bookings</button>
          </div>

          <div className="list">
            {bookings.map((booking) => (
              <div className="item" key={booking.booking_id}>
                <strong>{booking.passenger_name}</strong>
                <span>Status: {booking.status}</span>
                <small>Flight ID: {booking.flight_id}</small>
                <small>Booking ID: {booking.booking_id}</small>
              </div>
            ))}
          </div>
        </div>

        {/* ── Baggage ── */}
        <div className="card">
          <h2>Baggage</h2>
          <div className="actions">
            <button id="view-baggage-btn" onClick={getBaggage}>View Baggage</button>
          </div>

          <input
            id="baggage-id-input"
            value={baggageId}
            onChange={(e) => setBaggageId(e.target.value)}
            placeholder="Baggage ID"
          />
          <input
            id="baggage-status-input"
            value={baggageStatus}
            onChange={(e) => setBaggageStatus(e.target.value)}
            placeholder="Status"
          />
          <div className="actions">
            <button id="update-baggage-btn" onClick={updateBaggageStatus}>Update Status</button>
          </div>

          <div className="list">
            {baggage.map((bag) => (
              <div className="item" key={bag.baggage_id}>
                <strong>{bag.tag_number || bag.baggage_id}</strong>
                <span>Status: {bag.status}</span>
                <small>ID: {bag.baggage_id}</small>
              </div>
            ))}
          </div>
        </div>

        {/* ── Notifications (stub — /api/notifications not yet deployed) ── */}
        <div className="card">
          <h2>Notifications</h2>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            The notification service endpoint is not yet deployed on ECS.
            This section will be enabled in the next milestone.
          </p>
          <div className="list">
            {notifications.map((notification) => (
              <div className="item" key={notification.notification_id}>
                <strong>{notification.title || notification.message}</strong>
                <span>{notification.message}</span>
                <span>
                  Status: {notification.notification_status || (notification.read ? "READ" : "UNREAD")}
                </span>
                <small>ID: {notification.notification_id}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {message && <div className="message">{message}</div>}
    </div>
  );
}

export default App;