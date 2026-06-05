import os
import sys
from locust import HttpUser, between, task, events

# Validate PASSENGER_TOKEN at startup
PASSENGER_TOKEN = os.getenv("PASSENGER_TOKEN")
if not PASSENGER_TOKEN:
    print("PASSENGER_TOKEN environment variable is required.")
    sys.exit(1)

class AeroLinkPassengerUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        """Prepare authentication headers and validate access."""
        self.headers = {
            "Authorization": f"Bearer {PASSENGER_TOKEN}",
            "Content-Type": "application/json"
        }

        # Validate token and API availability with a single flight read
        with self.client.get(
            "/api/flights",
            headers=self.headers,
            name="Validation: GET /api/flights",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Passenger token validation failed or API unavailable: {response.status_code}")
                # We do not stop the runner completely on a single user validation failure,
                # but this will appear clearly in the failure logs.

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


@events.quitting.add_listener
def evaluate_results(environment, **kwargs):
    """
    Acceptance criteria for controlled normal-load test.
    Fail the build if latency or error rates exceed acceptable bounds.
    """
    if environment.stats.total.num_requests == 0:
        print("No requests were made. Failing load test.")
        environment.process_exit_code = 1
        return

    total = environment.stats.total
    
    # Calculate percentage explicitly to avoid division by zero
    fail_ratio = total.fail_ratio

    print("\n-----------------------------------------------------------")
    print("AeroLink Load Test Acceptance Criteria Evaluation:")

    criteria_passed = True

    if fail_ratio >= 0.01:
        print(f"FAILED: Failure rate {fail_ratio * 100:.2f}% >= 1.0%")
        criteria_passed = False
    else:
        print(f"PASSED: Failure rate {fail_ratio * 100:.2f}% < 1.0%")

    if total.avg_response_time >= 500:
        print(f"FAILED: Average response time {total.avg_response_time:.0f}ms >= 500ms")
        criteria_passed = False
    else:
        print(f"PASSED: Average response time {total.avg_response_time:.0f}ms < 500ms")

    p95 = total.get_response_time_percentile(0.95)
    if p95 >= 1000:
        print(f"FAILED: 95th percentile response time {p95:.0f}ms >= 1000ms")
        criteria_passed = False
    else:
        print(f"PASSED: 95th percentile response time {p95:.0f}ms < 1000ms")

    print("-----------------------------------------------------------\n")

    if not criteria_passed:
        environment.process_exit_code = 1
    else:
        environment.process_exit_code = 0
