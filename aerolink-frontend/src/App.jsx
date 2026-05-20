import { useState } from "react";
import "./App.css";

const API_BASE_URL = "https://keozoo3dx4.execute-api.us-east-1.amazonaws.com";

function App() {
  const [health, setHealth] = useState(null);
  const [flights, setFlights] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [flightId, setFlightId] = useState("");
  const [message, setMessage] = useState("");

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const data = await res.json();
      setHealth(data);
      setMessage("Health check successful");
    } catch (error) {
      setMessage("Health check failed");
    }
  };

  const getFlights = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/flights`);
      const data = await res.json();
      setFlights(data.items || []);
      setMessage("Flights loaded successfully");
    } catch (error) {
      setMessage("Failed to load flights");
    }
  };

  const createFlight = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/flights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          flight_no: "AL-FRONTEND-101",
          origin: "CMB",
          destination: "DXB",
          total_seats: 100,
          price: "320.00"
        })
      });

      const data = await res.json();
      const newFlightId = data.flight?.flight_id;

      if (newFlightId) {
        setFlightId(newFlightId);
        setMessage(`Flight created successfully. Flight ID: ${newFlightId}`);
        getFlights();
      } else {
        setMessage("Flight created, but flight ID was not returned");
      }
    } catch (error) {
      setMessage("Failed to create flight");
    }
  };

  const createBooking = async () => {
    if (!flightId) {
      setMessage("Please create or enter a flight ID first");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          flight_id: flightId,
          passenger_name: "Demo Passenger"
        })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Booking created successfully");
        getBookings();
      } else {
        setMessage(data.error || "Booking failed");
      }
    } catch (error) {
      setMessage("Failed to create booking");
    }
  };

  const getBookings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/bookings`);
      const data = await res.json();
      setBookings(data.items || []);
      setMessage("Bookings loaded successfully");
    } catch (error) {
      setMessage("Failed to load bookings");
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="tag">AeroLink Airline Systems Platform</p>
        <h1>Cloud-Based Airline Dashboard</h1>
        <p>
          React frontend connected to AWS API Gateway, Lambda, and DynamoDB.
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