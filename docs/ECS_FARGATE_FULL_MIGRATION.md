# AeroLink ECS/Fargate Full Migration Plan

## 1. Purpose

This document defines the ECS/Fargate deployment shape for the current AeroLink microservices platform. It is a deployment plan only. It does not change business logic, frontend behavior, Lambda/serverless code, Cognito, payment, or EventBridge in this phase.

The current local Docker Compose stack remains the development baseline, and the AWS Lambda/SAM path remains operational in parallel.

## 2. ECS Architecture Overview

AeroLink will run as a set of containerized services on Amazon ECS using the Fargate launch type.

- `api_gateway` will be the public entry point behind an Application Load Balancer.
- `auth_service`, `flight_service`, `booking_service`, `baggage_service`, and `schedule_service` will run as private ECS services.
- `event_consumer` will run as a private worker service.
- `rabbitmq` remains part of Phase 1 compatibility for local development and can also be deployed as a private ECS task for parity if needed.

Internal service communication stays private to the VPC and does not expose service ports publicly except through the ALB for `api_gateway`.

## 3. ECS Readiness Table

| Service | ECS status | Container port | Health check | Notes |
|---|---|---:|---|---|
| api_gateway | Ready for ECS deployment | 8000 | `/health` | Public ALB target |
| auth_service | Ready for ECS deployment | 8000 | `/health` | Private service |
| flight_service | Ready for ECS deployment | 8000 | `/health` | Publishes events via RabbitMQ in Phase 1 |
| booking_service | Ready for ECS deployment | 8000 | `/health` | Calls flight service by env URL |
| baggage_service | Ready for ECS deployment | 8000 | `/health` | Publishes events via RabbitMQ in Phase 1 |
| schedule_service | Ready for ECS deployment | 8000 | `/health` | Publishes events via RabbitMQ in Phase 1 |
| event_consumer | Ready for ECS deployment | N/A | worker task | No HTTP route; long-running consumer |
| rabbitmq | Ready as optional ECS broker task | 5672, 15672 | `rabbitmq-diagnostics ping` | Kept for Phase 1 compatibility |

## 4. ECR Repositories Needed

Create one ECR repository per image:

- `aerolink/api-gateway`
- `aerolink/auth-service`
- `aerolink/flight-service`
- `aerolink/booking-service`
- `aerolink/baggage-service`
- `aerolink/schedule-service`
- `aerolink/event-consumer`
- `aerolink/rabbitmq`

## 5. Build, Tag, and Push Commands

Use the repository URI format below as a pattern:

```bash
docker build -t aerolink/api-gateway -f services/api_gateway/Dockerfile .
docker tag aerolink/api-gateway:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/api-gateway:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/api-gateway:latest
```

Repeat for each service:

```bash
docker build -t aerolink/auth-service -f services/auth_service/Dockerfile .
docker tag aerolink/auth-service:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/auth-service:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/auth-service:latest

docker build -t aerolink/flight-service -f services/flight_service/Dockerfile .
docker tag aerolink/flight-service:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/flight-service:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/flight-service:latest

docker build -t aerolink/booking-service -f services/booking_service/Dockerfile .
docker tag aerolink/booking-service:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/booking-service:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/booking-service:latest

docker build -t aerolink/baggage-service -f services/baggage_service/Dockerfile .
docker tag aerolink/baggage-service:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/baggage-service:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/baggage-service:latest

docker build -t aerolink/schedule-service -f services/schedule_service/Dockerfile .
docker tag aerolink/schedule-service:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/schedule-service:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/schedule-service:latest

docker build -t aerolink/event-consumer -f services/event_consumer/Dockerfile .
docker tag aerolink/event-consumer:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/event-consumer:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/event-consumer:latest

docker pull rabbitmq:3-management
docker tag rabbitmq:3-management 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/rabbitmq:3-management
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/aerolink/rabbitmq:3-management
```

## 6. ECS Cluster Setup

1. Create an ECS cluster using Fargate capacity.
2. Create a VPC or reuse an existing VPC with private subnets for services.
3. Create security groups for:
   - ALB to `api_gateway`
   - `api_gateway` to private services
   - private services to RabbitMQ
4. Create IAM roles:
   - ECS task execution role
   - per-service task roles if AWS permissions are needed later
5. Create CloudWatch log groups before service launch or allow ECS to create them.

## 7. Task Definition Registration Steps

Register each task definition from the JSON placeholders in `infra/ecs/`.

Example:

```bash
aws ecs register-task-definition --cli-input-json file://infra/ecs/api_gateway-task.json
```

Repeat for the remaining services:

- `auth_service-task.json`
- `flight_service-task.json`
- `booking_service-task.json`
- `baggage_service-task.json`
- `schedule_service-task.json`
- `event_consumer-task.json`
- `rabbitmq-task.json`

## 8. ECS Service Creation Steps

Create one ECS service per task definition.

Recommended rollout order:

1. `rabbitmq` if you want cloud parity for the broker.
2. `auth_service`
3. `flight_service`
4. `booking_service`
5. `baggage_service`
6. `schedule_service`
7. `event_consumer`
8. `api_gateway` last, behind the ALB.

`api_gateway` should be the only public-facing service. All others should remain private inside the VPC.

## 9. ALB Entry Point for api_gateway

Use an Application Load Balancer to expose `api_gateway`.

- Listener: HTTP 80 for lab/demo or HTTPS 443 for production-style deployment
- Target group: `api_gateway` on container port 8000
- Health check path: `/health`
- Public DNS from ALB becomes the frontend/API base URL

## 10. Internal Communication Model

Private services communicate over service discovery or private DNS names.

Recommended environment variables:

- `AUTH_SERVICE_URL=http://auth_service:8001`
- `FLIGHT_SERVICE_URL=http://flight_service:8002`
- `BOOKING_SERVICE_URL=http://booking_service:8003`
- `BAGGAGE_SERVICE_URL=http://baggage_service:8004`
- `SCHEDULE_SERVICE_URL=http://schedule_service:8005`
- `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/`

Phase 1 compatibility note:

- RabbitMQ remains in place for current event publishing and consumer behavior.
- EventBridge is not added yet.
- Later phases can introduce EventBridge without changing the ECS artifact structure.

## 11. CloudWatch Logs Setup

Each ECS task definition uses `awslogs`:

- Log group per service, for example `/ecs/aerolink/api_gateway`
- Region: `us-east-1`
- Stream prefix: `ecs`

Recommended log groups:

- `/ecs/aerolink/api_gateway`
- `/ecs/aerolink/auth_service`
- `/ecs/aerolink/flight_service`
- `/ecs/aerolink/booking_service`
- `/ecs/aerolink/baggage_service`
- `/ecs/aerolink/schedule_service`
- `/ecs/aerolink/event_consumer`
- `/ecs/aerolink/rabbitmq`

## 12. Smoke Test Commands

After deployment, verify each service.

```bash
curl -i http://<ALB-DNS>/health
curl -i http://<ALB-DNS>/api/auth/health
curl -i http://<ALB-DNS>/api/flights/health
curl -i http://<ALB-DNS>/api/bookings/health
curl -i http://<ALB-DNS>/api/baggage/health
curl -i http://<ALB-DNS>/api/schedules/health
```

If you are testing direct service endpoints inside the VPC, use the private DNS or service name assigned by your ECS networking model.

## 13. Screenshots Checklist for the Report

Capture these screenshots for the migration evidence set:

1. ECR repositories list.
2. Docker build output for at least one service.
3. Docker push output for at least one service.
4. ECS cluster overview.
5. ECS service list.
6. Task definition details for `api_gateway`.
7. Task definition details for one private service.
8. ALB listener and target group.
9. CloudWatch log group for `api_gateway`.
10. CloudWatch log stream showing a request or startup log.
11. Health check response from the ALB endpoint.
12. Private service connectivity proof.
13. RabbitMQ task or local compatibility proof.
14. Screenshot showing the Lambda/serverless path remains available in parallel if you keep the SAM stack deployed.

## 14. Phase Boundary Notes

- Cognito is not part of this phase.
- Payment is not part of this phase.
- EventBridge is not part of this phase.
- Frontend behavior is unchanged in this phase.
- Lambda/serverless files remain untouched in this phase.

## 15. Next AWS Actions

1. Create ECR repositories.
2. Push the Docker images.
3. Register task definitions from `infra/ecs/`.
4. Create ECS services and the ALB.
5. Configure CloudWatch log groups and confirm logs flow.
6. Run the smoke tests.
7. Collect the screenshots listed above.
