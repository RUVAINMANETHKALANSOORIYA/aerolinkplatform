# AeroLink AWS Free Tier Implementation Evidence

## 1. AWS Practical Implementation Overview

A Free Tier-safe serverless version of AeroLink was deployed on AWS using Amazon API Gateway, AWS Lambda, Amazon DynamoDB, IAM, and CloudWatch. The implementation was created in the US East (N. Virginia) region, `us-east-1`, to match the assignment's AWS evidence requirements and keep the deployment within Free Tier-friendly limits.

This AWS version mirrors the core platform behavior in a managed-serverless architecture:
- API Gateway receives public HTTP requests.
- Lambda functions implement the application logic for health checks and core flight/booking workflows.
- DynamoDB stores flight and booking records.
- IAM controls Lambda permissions with least-privilege access.
- CloudWatch captures runtime logs and operational evidence.

## 2. AWS Services Used

The AWS implementation uses the following services:

- **API Gateway HTTP API** for public request routing.
- **AWS Lambda** for serverless application execution.
- **Amazon DynamoDB** for flight and booking persistence.
- **IAM execution role** for Lambda permissions.
- **Inline DynamoDB policy** attached to the Lambda role for least-privilege data access.
- **CloudWatch Logs** for function execution and request tracing.
- **CloudTrail Event History** for account activity and resource audit evidence.
- **AWS Budgets / Billing alert** to provide a cost-control safety net.

## 3. Implemented AWS API Routes

The AWS deployment implements the following HTTP routes:

- `GET /health`
- `GET /flights`
- `POST /flights`
- `GET /bookings`
- `POST /bookings`

These routes support the minimum practical workflow for the assignment's cloud evidence: service health, listing flights, creating flights, listing bookings, and creating bookings through the serverless API layer.

## 4. DynamoDB Tables

Two DynamoDB tables were used for the AWS deployment:

- **AeroLinkFlights**
  - Partition key: `flight_id`
  - Stores flight records, including identifiers, seat counts, and related flight metadata.

- **AeroLinkBookings**
  - Partition key: `booking_id`
  - Stores booking records, including passenger and flight references.

This table design keeps the schema simple and Free Tier-friendly while supporting the application flows required for the evidence set.

## 5. Security and IAM

The Lambda functions run under a dedicated IAM execution role. That role is configured so the function can log to CloudWatch and access only the DynamoDB actions required by the API behavior.

The DynamoDB access is protected through a least-privilege inline policy. The policy should only allow the exact table operations needed by the serverless functions, rather than broad account-wide permissions.

Additional account safety controls were used:
- **Root MFA** helps protect the AWS account from unauthorized root access.
- **AWS Budgets / billing alert** helps prevent unexpected charges and confirms the deployment stays Free Tier-safe.

## 6. Monitoring and Audit

CloudWatch Logs are used to monitor Lambda execution. This provides evidence that the API routes are being invoked correctly, and it also helps confirm request handling, errors, and operational behavior during testing.

CloudTrail Event History provides the audit trail for AWS account activity. It can be used to verify creation and use of API Gateway, Lambda, DynamoDB, IAM, and related AWS resources during the implementation process.

Together, CloudWatch and CloudTrail provide both runtime visibility and administrative evidence for the AWS deployment.

## 7. Evidence Screenshot Checklist

Capture the following screenshots as proof of the AWS implementation:

- `AWS_01_MFA_enabled.png`
- `AWS_02_budget_created.png`
- `AWS_03_region_us_east_1.png`
- `AWS_04_dynamodb_flights_table.png`
- `AWS_05_dynamodb_bookings_table.png`
- `AWS_06_lambda_function_created.png`
- `AWS_07_lambda_dynamodb_policy.png`
- `AWS_08_lambda_code_deployed.png`
- `AWS_09_lambda_health_test_success.png`
- `AWS_10_lambda_create_flight_success.png`
- `AWS_11_lambda_get_flights_success.png`
- `AWS_12_lambda_create_booking_success.png`
- `AWS_13_dynamodb_flight_item.png`
- `AWS_14_dynamodb_booking_item.png`
- `AWS_15_api_gateway_created.png`
- `AWS_16_api_gateway_health_success.png`
- `AWS_17_api_gateway_create_flight_postman.png`
- `AWS_18_api_gateway_get_flights_postman.png`
- `AWS_19_api_gateway_create_booking_postman.png`
- `AWS_20_cloudwatch_lambda_logs.png`
- `AWS_21_api_gateway_metrics.png`
- `AWS_22_cloudtrail_event_history.png`

## 8. Limitations

This AWS deployment is intentionally a Free Tier-safe practical implementation. It demonstrates the project in a lightweight serverless architecture that is suitable for evidence capture and basic cloud validation.

The full enterprise design would expand beyond the Free Tier sample and use:
- ECS/Fargate for containerized microservices
- Aurora for relational persistence
- EventBridge, SQS, or SNS for event-driven messaging
- AWS WAF for edge protection
- Multi-region deployment for resilience
- CI/CD pipelines for automated delivery and validation

## 9. Report Mapping

The AWS evidence maps to the assignment areas as follows:

- **Cloud-based implementation**
  - API Gateway, Lambda, DynamoDB, IAM, CloudWatch, CloudTrail, Budgets

- **API design**
  - Implemented HTTP routes for health, flights, and bookings

- **Security**
  - IAM execution role, least-privilege inline policy, root MFA, budget alert

- **Monitoring**
  - CloudWatch Logs, API execution visibility, CloudTrail audit history

- **Testing/evidence**
  - Screenshot checklist for deployed resources, API calls, DynamoDB items, and logs

- **Scalability/future enhancement**
  - Clear path to ECS/Fargate, Aurora, EventBridge/SQS/SNS, WAF, and multi-region deployment