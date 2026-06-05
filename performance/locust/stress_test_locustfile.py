import os
import sys
from locust import HttpUser, LoadTestShape, between, events, task

# Validate PASSENGER_TOKEN at startup
PASSENGER_TOKEN = os.getenv("PASSENGER_TOKEN")
if not PASSENGER_TOKEN:
    print("PASSENGER_TOKEN environment variable is required.")
    sys.exit(1)


class AeroLinkStressPassengerUser(HttpUser):
    wait_time = between(0.5, 1.5)

    def on_start(self):
        """Prepare authentication headers."""
        self.headers = {
            "Authorization": f"Bearer {PASSENGER_TOKEN}",
            "Content-Type": "application/json"
        }

    @task(5)
    def browse_flights(self):
        with self.client.get(
            "/api/flights",
            headers=self.headers,
            name="GET /api/flights",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Unexpected status code: {response.status_code}")

    @task(3)
    def view_bookings(self):
        with self.client.get(
            "/api/bookings/me",
            headers=self.headers,
            name="GET /api/bookings/me",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Unexpected status code: {response.status_code}")

    @task(2)
    def view_notifications(self):
        with self.client.get(
            "/api/notifications/me",
            headers=self.headers,
            name="GET /api/notifications/me",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Unexpected status code: {response.status_code}")

    @task(1)
    def view_baggage(self):
        with self.client.get(
            "/api/baggage/me",
            headers=self.headers,
            name="GET /api/baggage/me",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Unexpected status code: {response.status_code}")


class StagesShape(LoadTestShape):
    """
    Controlled Stress Shape defining stages of traffic increase.
    """
    stages = [
        {"duration": 60, "users": 20, "spawn_rate": 2},
        {"duration": 120, "users": 40, "spawn_rate": 5},
        {"duration": 180, "users": 60, "spawn_rate": 5},
        {"duration": 240, "users": 80, "spawn_rate": 5},
    ]

    def tick(self):
        run_time = self.get_run_time()
        for stage in self.stages:
            if run_time < stage["duration"]:
                tick_data = (stage["users"], stage["spawn_rate"])
                return tick_data
        return None


@events.quitting.add_listener
def evaluate_results(environment, **kwargs):
    """
    Stress test evaluation logic based on overall results.
    """
    if environment.stats.total.num_requests == 0:
        print("No requests were made. Cannot evaluate stress test.")
        return

    total = environment.stats.total
    fail_ratio = total.fail_ratio
    p95 = total.get_response_time_percentile(0.95)

    print("\n-----------------------------------------------------------")
    print("AeroLink Stress Test Result Classification:")
    
    # Safe result classification logic
    if fail_ratio < 0.01 and p95 < 1500:
        classification = "System remained stable under tested stress level"
    elif fail_ratio < 0.05 and p95 < 3000:
        classification = "Performance degraded but service remained operational"
    else:
        classification = "Stress threshold reached: scaling/resilience improvements required"

    print(f"Failure Rate: {fail_ratio * 100:.2f}%")
    print(f"95th Percentile Response Time: {p95:.0f} ms")
    print(f"Classification: {classification}")
    print("-----------------------------------------------------------\n")

