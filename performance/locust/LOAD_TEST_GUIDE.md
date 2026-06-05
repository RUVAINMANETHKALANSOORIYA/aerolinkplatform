# AeroLink Load Testing Guide

This guide outlines how to execute the controlled normal-load performance test against the deployed AeroLink Cloud Platform using Locust. 

## Load-Test Profile

This test simulates normal, authenticated Passenger browsing behaviour without changing live system data.

| Parameter                | Value                                      |
|--------------------------|-------------------------------------------:|
| Test type                | Authenticated Passenger read-only load test|
| Maximum concurrent users | 20                                         |
| Spawn rate               | 2 users per second                         |
| Test duration            | 3 minutes                                  |
| Requests                 | GET requests only                          |
| Data mutation            | None                                       |

## Acceptance Criteria
The script automatically evaluates the following limits:
* Overall failure rate must be below 1%
* Average response time should be below 500 ms
* 95th percentile response time should be below 1000 ms

## Execution Instructions

### 1. Install Locust Only If Missing
If you do not have Locust installed locally, open PowerShell and install it manually:
```powershell
python -m pip install locust
locust --version
```

### 2. Prepare a Fresh Passenger Token
1. Sign in to the hosted AeroLink frontend using a confirmed Passenger account.
2. Copy the fresh Cognito access token from browser storage (Developer Tools -> Application -> Local Storage) for temporary testing use.
3. **Important:** Do not paste or screenshot the token in the report. 
4. Run the test soon after obtaining the token so it does not expire during the three-minute test.

### 3. Start Locust Web UI for Visual Evidence
Run this command in your repository root, replacing `PASTE_FRESH_PASSENGER_ACCESS_TOKEN_HERE` with your token:

```powershell
cd D:\aerolink_platform_v3_phase1_api_gateway\aerolink_platform

$env:PASSENGER_TOKEN = "PASTE_FRESH_PASSENGER_ACCESS_TOKEN_HERE"

locust -f .\performance\locust\locustfile.py
```

Then open your browser to:
```text
http://localhost:8089
```

In the Locust UI, enter:
* **Number of users:** 20
* **Ramp up:** 2 users per second
* **Host:** `PASTE_DEPLOYED_API_BASE_URL_HERE`
* **Run time:** 3 minutes (or stop manually at 3 minutes if the UI does not provide a duration field)

### 4. Run a Deterministic Headless Test for Exportable Results
If you prefer to run a headless load test that strictly adheres to the 3-minute limit and generates exportable CSV and HTML reports, use this command:

```powershell
$env:PASSENGER_TOKEN = "PASTE_FRESH_PASSENGER_ACCESS_TOKEN_HERE"
$BaseUrl = "PASTE_DEPLOYED_API_BASE_URL_HERE"

locust `
  -f .\performance\locust\locustfile.py `
  --host $BaseUrl `
  --headless `
  -u 20 `
  -r 2 `
  -t 3m `
  --csv .\performance\locust\results\aerolink_load `
  --html .\performance\locust\results\aerolink_load_report.html
```
This generates report-ready result files in the `performance/locust/results/` folder:
* `aerolink_load_stats.csv`
* `aerolink_load_stats_history.csv`
* `aerolink_load_failures.csv`
* `aerolink_load_report.html`

### 5. Clean the Token After Testing
```powershell
Remove-Item Env:PASSENGER_TOKEN -ErrorAction SilentlyContinue
```

## CloudWatch Monitoring Evidence
Keep AWS CloudWatch open during the Locust load test and capture evidence from the same test time window:
* API Gateway ECS log activity during repeated GET requests.
* ECS service healthy/running state.
* Relevant ALB/ECS request or response metrics if available.
* CloudWatch logs showing successful request handling.
* Note: No Lambda activity is expected from this read-only load test unless an unrelated background event occurs.

## Report Evidence Screenshots Required
Capture the following pieces of evidence for your assignment report:
1. **Locust web dashboard** during the test showing active users, requests per second and response-time chart.
2. **Locust final statistics table** showing: request count, failure count, average response time, median response time, p95 response time, maximum response time, and requests per second.
3. **Headless terminal result** showing pass/fail of performance criteria.
4. **Generated HTML report** or CSV result table.
5. **CloudWatch activity** during the same test time window.

**Warnings:**
* Do not capture visible Passenger tokens.
* Mask the full deployed host URL in screenshots used in the final report.
* Mask any identifiers or private passenger data if displayed.

## Expected Report Results Table
Use this empty table in your final report to summarize your load test outcome:

| Test Type | Users | Spawn Rate | Duration | Total Requests | Failures | Avg Response Time | p95 Response Time | Throughput (RPS) | Error Rate | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Controlled Passenger Load Test | 20 | 2 users/s | 3 minutes |  |  |  |  |  |  |  |
