# AeroLink Evidence Index

## 1. Local Implementation Evidence

- Docker containers running
- API Gateway Swagger
- JWT login success
- Missing token blocked
- Passenger RBAC blocked
- Staff flight creation
- Baggage creation/update
- Schedule creation/update
- RabbitMQ dashboard
- Event consumer logs

## 2. Testing Evidence

- Pytest result showing 9 tests passed
- Postman API tests
- Locust normal load test with 0% failures
- Locust stress/capacity test

## 3. Monitoring and Observability Evidence

- Gateway `/health` response
- Gateway `/metrics` response
- `X-Request-ID` response header
- Structured Docker logs
- Event consumer logs

## 4. AWS Free Tier Evidence

- MFA enabled
- Budget alert
- Region selected: `us-east-1`
- DynamoDB tables
- Lambda function
- Lambda DynamoDB IAM policy
- Lambda test results
- API Gateway HTTP API
- Public `/health` endpoint
- Postman tests through API Gateway
- CloudWatch logs
- API Gateway metrics
- CloudTrail event history

## 5. Report Mapping

- **Architecture:** Docker containers running, Swagger, RabbitMQ, event consumer, AWS API Gateway/Lambda/DynamoDB
- **Security:** JWT login, missing token blocked, RBAC blocked, MFA, IAM policy, budget alert
- **API design:** Gateway routes, health endpoints, public AWS HTTP API routes, Postman tests
- **Distributed services:** Baggage service, schedule service, event consumer, RabbitMQ, CloudTrail evidence
- **Testing:** Pytest, Postman, Locust normal load, Locust stress test, Lambda test results
- **Performance:** Locust normal load test, Locust stress/capacity test, Gateway metrics
- **Monitoring:** `/health`, `/metrics`, `X-Request-ID`, structured logs, CloudWatch logs
- **AWS implementation:** Region, DynamoDB tables, Lambda, API Gateway, CloudWatch, IAM
- **Audit/compliance:** CloudTrail event history, MFA, budget alert, security evidence