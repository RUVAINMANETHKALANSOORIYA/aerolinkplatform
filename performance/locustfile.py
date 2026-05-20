import uuid

from locust import HttpUser, between, task


class AeroLinkUser(HttpUser):
    """
    Normal Load Test for AeroLink Platform.
    
    This test creates a dedicated load test flight with 10,000 seats upfront,
    then runs normal user workloads (browsing, booking) against it. With sufficient
    seat capacity, seat-exhaustion failures are avoided, allowing realistic
    performance testing without test noise.
    
    Recommended Locust settings:
    - Users: 20
    - Spawn rate: 2
    - Duration: 1–2 minutes
    """
    
    host = "http://localhost:8080"
    wait_time = between(1, 3)

    def on_start(self):
        """Initialize test: register staff and passenger, create load test flight."""
        # Register and login staff user for flight creation
        self.staff_username = f"locust_staff_{uuid.uuid4().hex[:8]}"
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
        
        # Register and login passenger user for normal operations
        self.passenger_username = f"locust_passenger_{uuid.uuid4().hex[:8]}"
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
        
        # Create dedicated load test flight with high seat capacity
        # This prevents seat exhaustion during normal load testing
        self.flight_id = None
        if self.staff_token:
            flight_no = f"LOAD_TEST_{uuid.uuid4().hex[:6]}"
            create_flight = self.client.post(
                "/api/flights",
                params={
                    "flight_no": flight_no,
                    "seats": 10000,  # High capacity prevents seat exhaustion
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

    @task(3)
    def browse_flights(self):
        """Browse available flights (passenger action)."""
        self.client.get(
            "/api/flights",
            headers=self._auth_headers(),
            name="/api/flights",
        )

    @task(2)
    def browse_schedules(self):
        """Browse flight schedules (passenger action)."""
        self.client.get(
            "/api/schedules",
            headers=self._auth_headers(),
            name="/api/schedules",
        )

    @task(1)
    def create_booking(self):
        """Create a booking for the load test flight (passenger action)."""
        if not self.flight_id:
            return
        
        self.client.post(
            "/api/bookings",
            params={
                "name": self.passenger_username,
                "flight_id": self.flight_id,
            },
            headers=self._auth_headers(),
            name="/api/bookings",
        )
