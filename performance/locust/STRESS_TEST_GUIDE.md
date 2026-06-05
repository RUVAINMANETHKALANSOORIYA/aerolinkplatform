# AeroLink Stress Testing Guide

This guide outlines how to execute a separate controlled stress test against the deployed AeroLink Cloud Platform using Locust. 

**Safety Warning:**
Stop the running test manually if:
* repeated `5xx` failures occur;
* error rate becomes excessive;
* CloudWatch shows unhealthy ECS task behaviour;
* response latency becomes unacceptable;
* the application becomes unavailable for normal use.

## 1. Verify Locust Installation

If you do not have Locust installed locally, open PowerShell and install it manually:
```powershell
python -m pip install locust
python -m locust --version
```

## 2. Prepare Fresh Passenger Token

* Sign in to the hosted AeroLink application using a confirmed Passenger test account.
* Copy the Cognito access token temporarily for testing (from browser Developer Tools -> Application -> Local Storage).
* **Important:** Never paste the token into code, Git, screenshots or the final report.

## 3. Open CloudWatch Before Stress Testing

Keep CloudWatch open during the stress-test window and capture evidence:
* API Gateway ECS logs;
* ECS running task/health state;
* ALB or ECS request metrics if available;
* failure/error logs if the application begins to degrade.

## 4. Run Stress Test with the Locust Dashboard

Run this command in your repository root, replacing `PASTE_FRESH_PASSENGER_ACCESS_TOKEN_HERE` with your token:

```powershell
cd D:\aerolink_platform_v3_phase1_api_gateway\aerolink_platform

$env:PASSENGER_TOKEN = "PASTE_FRESH_PASSENGER_ACCESS_TOKEN_HERE"

python -m locust `
  -f .\performance\locust\stress_test_locustfile.py
```

Then open your browser to:
```text
http://localhost:8089
```

Enter the deployed API base URL in the **Host** field and start the test. Since the custom shape controls users and duration automatically, do not manually choose a higher number of users in the dashboard inputs.

## 5. Run a Headless Exportable Stress Test

If you prefer to run a headless stress test that exports CSV and HTML reports automatically, use this command:

```powershell
$BaseUrl = "PASTE_DEPLOYED_API_BASE_URL_HERE"

python -m locust `
  -f .\performance\locust\stress_test_locustfile.py `
  --host $BaseUrl `
  --headless `
  --csv .\performance\locust\results\stress\aerolink_stress `
  --html .\performance\locust\results\stress\aerolink_stress_report.html
```

Expected generated result files:
* `performance/locust/results/stress/aerolink_stress_stats.csv`
* `performance/locust/results/stress/aerolink_stress_stats_history.csv`
* `performance/locust/results/stress/aerolink_stress_failures.csv`
* `performance/locust/results/stress/aerolink_stress_report.html`

## 6. Clear Sensitive Token Afterwards

```powershell
Remove-Item Env:PASSENGER_TOKEN -ErrorAction SilentlyContinue
```

## Required Screenshots for Report Evidence

Recommend capturing these pieces of evidence for your assignment report:
1. Locust stress dashboard during Stage 4 showing approximately 80 concurrent users.
2. Locust statistics table showing requests, failures, average latency, p95 latency, maximum latency and RPS.
3. Locust charts showing how response time changes as users increase.
4. Headless terminal conclusion showing the stress-test classification.
5. CloudWatch logs/metrics during the same stress-testing time range.

**Warnings:**
* Mask the full deployed host URL.
* Do not display the Passenger access token.
* Hide private IDs or passenger records.

## Report Results Table Templates

Include these empty tables in your final report to summarize your stress test outcomes:

| Test Type | Maximum Users | Duration | Total Requests | Failures | Avg Response Time | p95 Response Time | Throughput (RPS) | Error Rate | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Controlled Passenger Stress Test | 80 | 4 minutes |  |  |  |  |  |  |  |

### Comparison Table

| Metric | Normal Load Test | Stress Test | Analysis |
|---|---:|---:|---|
| Maximum concurrent users | 20 | 80 | |
| Total requests | | | |
| Failure rate | | | |
| Average response time | | | |
| p95 response time | | | |
| Throughput | | | |
