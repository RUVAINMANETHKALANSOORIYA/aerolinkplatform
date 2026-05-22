# AeroLink — Deployment with AWS SAM

Prerequisites
- An AWS account and CLI configured with credentials (`aws configure`).
- AWS SAM CLI installed (https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html).
- Docker is optional but recommended for local testing with `sam local`.

Quick deploy (recommended)

1. From the project root, change into the `infra/` directory:

```bash
cd infra
```

2. Build the SAM application:

```bash
sam build
```

3. Deploy (first-time guided deploy):

```bash
sam deploy --guided
```

Follow prompts. You can accept defaults; the template uses `../services/aws_lambda` as the `CodeUri`.

Notes about packaging
- `CodeUri` points at `../services/aws_lambda`. `sam build` and `sam deploy` will package that code into the deployment bundle.

How to test the API

After deployment SAM prints the API endpoint. Suppose the endpoint is:

```
https://abcd1234.execute-api.us-east-1.amazonaws.com
```

Health check

```bash
curl -i -X GET "https://<API_ENDPOINT>/health"
```

Create a flight (example)

```bash
curl -i -X POST "https://<API_ENDPOINT>/flights" \
  -H 'Content-Type: application/json' \
  -d '{"flight_number":"AL-123","total_seats":100,"price":199.99}'
```

Booking example

```bash
curl -i -X POST "https://<API_ENDPOINT>/bookings" \
  -H 'Content-Type: application/json' \
  -d '{"flight_id":"<flight_id>","passenger_name":"Alice","seat_count":1}'
```

Collecting screenshot evidence for the assignment

- API Gateway: take a screenshot showing the API in the API Gateway console and the deployed stage/endpoint.
- Health check: a screenshot of a successful `curl` or Postman response for `GET /health`.
- Lambda: open the Lambda console entry for `AeroLinkServerlessHandler` and capture its Configuration page.
- CloudWatch Logs: open CloudWatch Logs and capture the log group `/aws/lambda/AeroLinkServerlessHandler` and a representative log stream showing request handling.
- DynamoDB: open the DynamoDB console and capture a screenshot listing the six tables created (AeroLinkUsers, AeroLinkFlights, AeroLinkBookings, AeroLinkBaggage, AeroLinkSchedules, AeroLinkNotifications) and show sample items.

How this satisfies the assignment requirements

- Serverless compute: the routing and business logic live inside `services/aws_lambda/lambda_function.py` and are deployed as an AWS Lambda function.
- Managed database: each service table is a DynamoDB table with server-side encryption and pay-per-request billing.
- API Gateway: an HTTP API is created and proxied to the Lambda function to serve the public REST/HTTP endpoints.
- Monitoring: Lambda automatically writes logs to CloudWatch Logs; use CloudWatch to collect invocation/error evidence and metrics.
- Reproducible deployment: `infra/template.yaml` is a SAM/CloudFormation template that provisions the required resources and can be deployed via `sam build` and `sam deploy`.

Troubleshooting
- If `sam deploy` fails due to permissions, ensure the AWS credentials have CloudFormation, Lambda, API Gateway, and DynamoDB permissions.
- If `CodeUri` fails to locate files, run `sam build` from the `infra/` directory and verify `../services/aws_lambda` exists relative to `infra/`.
