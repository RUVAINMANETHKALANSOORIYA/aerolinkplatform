import { useState } from "react";
import "./App.css";
import { API_BASE_URL } from "./config.js";

async function requestJson(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    ...(options.headers || {}),
  };

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
      throw new Error(data?.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("Fetch error", {
      url,
      path,
      options,
      error,
    });
    throw error;
  }
}

function App() {
  const [health, setHealth] = useState(null);
  const [flights, setFlights] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [baggage, setBaggage] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [flightId, setFlightId] = useState("");
  const [baggageId, setBaggageId] = useState("");
  const [baggageStatus, setBaggageStatus] = useState("loaded");
  const [message, setMessage] = useState("");

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

  const getFlights = async () => {
    try {
      const data = await requestJson("/flights");
      setFlights(data.items || []);
      setMessage(data.message || "Flights loaded successfully");
    } catch (error) {
      console.error("Load flights failed", error);
      setMessage(error.message || "Failed to load flights");
    }
  };

  const createFlight = async () => {
    try {
      const data = await requestJson("/flights", {
        method: "POST",
        body: JSON.stringify({
          flight_no: "AL-FRONTEND-101",
          origin: "CMB",
          destination: "DXB",
          total_seats: 100,
          price: "320.00"
        })
      });

      const newFlightId = data.item?.flight_id;

      if (newFlightId) {
        setFlightId(newFlightId);
        setMessage(data.message || `Flight created successfully. Flight ID: ${newFlightId}`);
        getFlights();
      } else {
        setMessage(data.message || "Flight created, but flight ID was not returned");
      }
    } catch (error) {
      console.error("Create flight failed", error);
      setMessage(error.message || "Failed to create flight");
    }
  };

  const createBooking = async () => {
    if (!flightId) {
      setMessage("Please create or enter a flight ID first");
      return;
    }

    try {
      const data = await requestJson("/bookings", {
        method: "POST",
        body: JSON.stringify({
          flight_id: flightId,
          passenger_name: "Demo Passenger",
          seat_count: 1
        })
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
      const data = await requestJson("/bookings");
      setBookings(data.items || []);
      setMessage(data.message || "Bookings loaded successfully");
    } catch (error) {
      console.error("Load bookings failed", error);
      setMessage(error.message || "Failed to load bookings");
    }
  };

  const getBaggage = async () => {
    try {
      const data = await requestJson("/baggage");
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
      const data = await requestJson(`/baggage/${baggageId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: baggageStatus })
      });

      setMessage(data.message || "Baggage status updated successfully");
      getBaggage();
    } catch (error) {
      console.error("Update baggage status failed", error);
      setMessage(error.message || "Failed to update baggage status");
    }
  };

  const getNotifications = async () => {
    try {
      const data = await requestJson("/notifications");
      setNotifications(data.items || []);
      setMessage(data.message || "Notifications loaded successfully");
    } catch (error) {
      console.error("Load notifications failed", error);
      setMessage(error.message || "Failed to load notifications");
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="tag">AeroLink Airline Systems Platform</p>
        <h1>Cloud-Based Airline Dashboard</h1>
        <p>
          React frontend connected to AWS API Gateway, Lambda, DynamoDB, and CORS-enabled serverless routes.
        </p>
      </header>

      <section className="cards">
        <div className="card">
          <h2>System Health</h2>
          <button onClick={checkHealth}>Check Health</button>
          {health && (
            <pre>{JSON.stringify(health, null, 2)}</pre>
          )}
        </div>

        <div className="card">
          <h2>Flights</h2>
          <div className="actions">
            <button onClick={createFlight}>Create Flight</button>
            <button onClick={getFlights}>View Flights</button>
          </div>

          <input
            value={flightId}
            onChange={(e) => setFlightId(e.target.value)}
            placeholder="Flight ID for booking"
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

        <div className="card">
          <h2>Bookings</h2>
          <div className="actions">
            <button onClick={createBooking}>Create Booking</button>
            <button onClick={getBookings}>View Bookings</button>
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

        <div className="card">
          <h2>Baggage</h2>
          <div className="actions">
            <button onClick={getBaggage}>View Baggage</button>
          </div>

          <input
            value={baggageId}
            onChange={(e) => setBaggageId(e.target.value)}
            placeholder="Baggage ID"
          />
          <input
            value={baggageStatus}
            onChange={(e) => setBaggageStatus(e.target.value)}
            placeholder="Status"
          />
          <div className="actions">
            <button onClick={updateBaggageStatus}>Update Status</button>
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

        <div className="card">
          <h2>Notifications</h2>
          <div className="actions">
            <button onClick={getNotifications}>View Notifications</button>
          </div>

          <div className="list">
            {notifications.map((notification) => (
              <div className="item" key={notification.notification_id}>
                <strong>{notification.message}</strong>
                <span>Read: {notification.read ? "Yes" : "No"}</span>
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