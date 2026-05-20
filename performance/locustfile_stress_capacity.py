"""
Stress Test: Capacity Failure Under Load

This test deliberately uses a low-seat flight (10 seats) to demonstrate
what happens when seat capacity is exhausted under load. Use this to:

1. Observe how the system handles 400 errors (no seats available)
2. Measure error rates under stress
3. Verify graceful degradation
4. Understand failure mode behavior

Recommended Locust settings:
- Users: 50 (high concurrency)
- Spawn rate: 5 (spawn quickly)
- Duration: 2-3 minutes
"""

import uuid

from locust import HttpUser, between, task


class AeroLinkStressUser(HttpUser):
    """
    Stress Test: Capacity Exhaustion.
    
    Creates a flight with only 10 seats and runs high-concurrency bookings
    against it to demonstrate seat exhaustion behavior.
    """
    
    host = "http://localhost:8080"
    wait_time = between(1, 3)

    def on_start(self):
        """Initialize: register users and create low-capacity flight."""
        # Register and login staff user for flight creation
        self.staff_username = f"stress_staff_{uuid.uuid4().hex[:8]}"
        self.staff_password = "secret123"
        self.staff_token = None
        
        self.client.post(
            "/api/auth/register",
            params={
                "username": self.staff_username,
                "password": self.staff_password,
                "role": "staff",
            },
            name="/api/auth/register",
        )
        
        staff_login = self.client.post(
            "/api/auth/login",
            data={"username": self.staff_username, "password": self.staff_password},
            name="/api/auth/login",
        )
        if staff_login.status_code == 200:
            self.staff_token = staff_login.json().get("access_token")
        
        # Register and login passenger user
        self.passenger_username = f"stress_passenger_{uuid.uuid4().hex[:8]}"
        self.passenger_password = "secret123"
        self.passenger_token = None
        
        self.client.post(
            "/api/auth/register",
            params={
                "username": self.passenger_username,
                "password": self.passenger_password,
                "role": "passenger",
            },
            name="/api/auth/register",
        )
        
        passenger_login = self.client.post(
            "/api/auth/login",
            data={"username": self.passenger_username, "password": self.passenger_password},
            name="/api/auth/login",
        )
        if passenger_login.status_code == 200:
            self.passenger_token = passenger_login.json().get("access_token")
        
        # Create LOW-CAPACITY flight to force seat exhaustion
        self.flight_id = None
        if self.staff_token:
            flight_no = f"STRESS_TEST_{uuid.uuid4().hex[:6]}"
            create_flight = self.client.post(
                "/api/flights",
                params={
                    "flight_no": flight_no,
                    "seats": 10,  # Very low capacity — will exhaust quickly
                },
                headers={"Authorization": f"Bearer {self.staff_token}"},
                name="/api/flights",
            )
            
            if create_flight.status_code == 200:
                self.flight_id = create_flight.json().get("id")

    def _auth_headers(self):
        """Return Authorization header for passenger requests."""
        if not self.passenger_token:
            return {}
        return {"Authorization": f"Bearer {self.passenger_token}"}

    @task(1)
    def stress_bookings(self):
        """Stress test: attempt bookings on low-capacity flight."""
        if not self.flight_id:
            return
        
        # Use catch_response to track seat-exhaustion failures separately
        with self.client.post(
            "/api/bookings",
            params={
                "name": self.passenger_username,
                "flight_id": self.flight_id,
            },
            headers=self._auth_headers(),
            name="/api/bookings",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 400:
                # Expected: seat exhaustion
                response.failure(f"Seat exhaustion (expected): {response.text}")
            else:
                response.failure(f"Unexpected error: {response.status_code}")
