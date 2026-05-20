# AeroLink COMP60010 Final Report Draft

## 1. Title Page

- Module: COMP60010 Enterprise Cloud and Distributed Web Applications
- Project: AeroLink Airline Systems Platform
- Student name: [Insert Student Name]
- Student ID: [Insert Student ID]
- Date: [Insert Date]

## 2. Executive Summary

The AeroLink project addresses the practical and architectural challenge of transforming an airline systems platform from a monolithic application structure into a cloud-native distributed system. In a monolithic design, core functions such as authentication, flight management, booking, baggage handling, and schedule management tend to share a tightly coupled runtime and data model. While this approach may be acceptable for early prototyping, it becomes increasingly difficult to scale, secure, maintain, and adapt as the system grows. AeroLink therefore demonstrates a more contemporary cloud approach in which these responsibilities are separated into independently deployable services and coordinated through an API Gateway and event-driven messaging.

The implemented solution combines two complementary layers of evidence. First, a local Docker-based microservices platform demonstrates the practical decomposition of the application into services such as api_gateway, auth_service, flight_service, booking_service, baggage_service, schedule_service, and event_consumer, supported by RabbitMQ for asynchronous event handling. Second, a Free Tier-safe AWS serverless implementation provides practical cloud evidence using API Gateway HTTP API, AWS Lambda, DynamoDB, IAM, CloudWatch, and CloudTrail. Together, these layers show both the operational feasibility of the design and the alignment of the implementation with cloud-native principles.

From an architectural perspective, the solution demonstrates how API Gateway can provide a single public entry point, how Lambda can support lightweight serverless workloads, how DynamoDB can serve as a managed data store for scalable persistence, and how event-driven communication can support asynchronous updates such as price changes, seat reservations, baggage status updates, and schedule changes. The project also includes testing and monitoring evidence to show that the services behave correctly under unit, integration, API, and load-testing scenarios. In summary, AeroLink provides a realistic distributed web application for airline operations and a structured evidence base for the assignment requirements.
    
## 3. Introduction

AeroLink is an airline systems scenario that requires multiple coordinated operational capabilities, including user authentication, flight management, booking, baggage tracking, and schedule management. These capabilities are characteristic of a real-world enterprise platform because they must support many users, frequent updates, and reliable access to shared business data. A monolithic architecture can simplify early development, but it often becomes a constraint when the system must scale, evolve, or integrate with other services. The purpose of the AeroLink project is therefore to show how such a scenario can be restructured into a distributed cloud-based design that is more suitable for modern operational and deployment requirements.

This report demonstrates two connected but distinct outcomes. The first is a local distributed implementation built with Docker Compose, microservices, an API Gateway, RabbitMQ, and observability features such as health checks, metrics, and request tracing. The second is a practical AWS Free Tier serverless implementation that supports cloud evidence for API Gateway, Lambda, DynamoDB, IAM, CloudWatch, and CloudTrail. The local system shows the service decomposition and runtime behaviour, while the AWS evidence demonstrates that the project can be mapped to managed cloud services in a cost-conscious manner.

The report is organised to move from the problem definition and requirements, to the target cloud architecture, to the implemented local microservices platform, to the AWS evidence, testing, monitoring, limitations, and future enhancements. This structure is intended to provide a coherent narrative from design rationale through to implementation and evaluation. In doing so, the report shows not only what was built, but also why the chosen architecture is appropriate for a cloud-based distributed airline platform.

## 4. Requirements Analysis

The AeroLink solution was designed in response to a set of cloud and distributed application requirements that are common to modern airline systems. These requirements shape the architecture and justify the move away from a monolithic platform. Rather than treating the system as a single deployable application, the design decomposes functionality into services that can evolve, scale, and fail independently.

High availability is required because airline systems must remain accessible for customers, staff, and operations teams. A service outage in a booking or flight information system can affect revenue, customer satisfaction, and operational continuity. The architecture therefore needs to reduce single points of failure and support components that can be monitored and restarted independently.

Global scalability is important because airline platforms must handle variable demand across regions, time zones, and seasonal peaks. A cloud-native approach supports horizontal scaling by allowing services to be replicated or scaled independently according to demand. Microservices, serverless execution, and managed databases are particularly relevant here because they allow capacity to be increased without redesigning the entire system.

Fault tolerance is required because failures in one part of the system should not bring down the complete platform. Distributed systems inevitably encounter partial failures, network delays, and transient dependency issues. For that reason, the AeroLink design includes retry logic, health checks, asynchronous messaging, and service separation so that one failing component does not immediately halt all operations.

Real-time data synchronisation is also essential. Changes such as seat reservations, flight price updates, baggage status changes, and schedule modifications must be reflected quickly across the wider system. This requirement supports the use of event-driven architecture, because events can propagate changes to consumers without requiring every service to remain tightly synchronised through direct point-to-point calls.

Security and compliance are central to the domain because airline systems process sensitive user data and transactional records. Authentication, role-based access control, IAM permissions, audit logging, and careful handling of credentials are necessary to reduce risk and support good governance. In a cloud environment, these controls must extend beyond application logic to include infrastructure permissions and logging.

API-based integration is required because the system must support clear boundaries between the user interface, the gateway layer, and the backend services. A consistent API strategy makes the system easier to test, document, and extend, while also allowing future integration with mobile apps, third-party systems, or external operational tools.

Taken together, these requirements justify an architecture built around microservices, API Gateway, managed cloud services, and event-driven communication. They also provide the basis for evaluating whether the implemented solution is suitable for a cloud-based distributed web application.

## 5. Proposed Cloud Architecture

The target enterprise architecture for AeroLink is a cloud-native distributed design using managed and scalable AWS services. In its full production form, the architecture would place an API Gateway in front of the application to provide a single external entry point, route traffic to the appropriate services, and support security controls at the edge. Behind the gateway, containerised microservices would be deployed on ECS/Fargate or Kubernetes, enabling independent scaling and deployment of functional domains such as authentication, flight operations, booking, baggage, and scheduling.

For workloads that are lightweight, event-driven, or operationally simple, AWS Lambda would be used as a serverless execution model. This supports cost efficiency and elasticity, especially for tasks that do not require continuously running containers. For persistence, the target architecture would use DynamoDB and/or Aurora depending on the access pattern: DynamoDB for high-throughput key-value or document-style operations, and Aurora for relational data requiring stronger relational modelling. This separation allows the platform to use managed databases that match the nature of the workload rather than forcing a single storage model across all services.

The target design also includes EventBridge, SQS, or SNS to support asynchronous service communication. These services are suitable for decoupling publishers and consumers, reducing direct dependencies, and improving resilience in the presence of transient failures. CloudWatch would be used for metrics and logs, while CloudTrail would provide audit visibility across the AWS environment. IAM would govern service permissions, Cognito could provide managed identity support where required, JWT would support token-based authentication, and RBAC would enforce role-specific access to airline functions. WAF would provide an additional layer of perimeter protection in a production deployment.

In practical terms, the assignment also requires a smaller Free Tier-safe implementation to demonstrate AWS evidence. This practical subset uses API Gateway HTTP API, Lambda, DynamoDB, IAM, CloudWatch, and CloudTrail in the us-east-1 region. It is intentionally narrower than the full enterprise architecture, but it demonstrates the same core cloud principles in a cost-conscious way suitable for student accounts. The Free Tier implementation is therefore best understood as a validated subset of the target architecture rather than the complete production system.

The relationship between the two architecture levels is important. The enterprise architecture expresses the full design intent for a scalable and resilient airline platform, whereas the Free Tier implementation provides practical evidence that the design can be realised using managed AWS services. This distinction allows the report to be academically rigorous while remaining honest about what was implemented and what remains part of the future production target.

[Figure 1: Target AWS Cloud Architecture]

[Figure 2: Practical AWS Free Tier Serverless Implementation]

## 6. Local Microservices Implementation

The implemented local system demonstrates the full microservices decomposition of the AeroLink platform in a reproducible Docker-based environment. It consists of eight core components, each serving a distinct responsibility within the distributed application.

The `api_gateway` service is the public entry point for the system and runs on `localhost:8080`. It receives external requests, applies authentication and role-based access control, and forwards traffic to the appropriate internal service. This design prevents clients from communicating directly with internal services and provides a clean boundary between public and private components.

The `auth_service` is responsible for user registration, login, token generation, and token verification. It provides the security foundation for the rest of the system by issuing JWTs and validating authenticated requests.

The `flight_service` manages flight records, including flight creation, flight listing, seat reservation, and price updates. It also publishes flight-related events so that changes can be propagated to other parts of the system.

The `booking_service` manages booking creation and coordinates booking requests with the flight service. It includes retry logic so that transient communication issues do not immediately cause a booking operation to fail.

The `baggage_service` handles baggage creation, viewing, and status updates. It allows baggage information to be tracked independently from flight and booking records while still participating in the wider airline workflow.

The `schedule_service` manages flight schedules, including schedule creation, viewing, and updates such as status and gate changes. It supports operational visibility for flight timing and departure coordination.

The `event_consumer` service listens to the RabbitMQ queue and processes events generated by the core services. It demonstrates how asynchronous processing can be used to support downstream reactions to business changes.

The `rabbitmq` service provides the message broker used for asynchronous communication between producers and consumers. It enables event publication and consumption without forcing every service interaction to occur synchronously.

The entire local platform is orchestrated with Docker Compose, which allows all services to run together in a consistent and repeatable environment. This approach is appropriate for development and assessment because it reduces environment drift, simplifies startup, and supports integration testing across multiple services. In addition, the FastAPI-based services expose Swagger/OpenAPI documentation, which provides a clear and interactive view of the available routes. This documentation supports both functional understanding and verification of the API surface.

[Figure 3: Docker Containers Running]

[Figure 4: API Gateway Swagger/OpenAPI Routes]

## 7. Distributed API and Event-Driven Design

AeroLink combines REST APIs with event-driven messaging to support both synchronous interactions and asynchronous coordination. REST APIs are appropriate for direct client-to-service communication when a request requires an immediate response, such as registering a user, listing flights, or creating a booking. This request-response style is straightforward for clients to use, easy to document with OpenAPI, and suitable for operations where the client must know the result immediately.

RabbitMQ is used for asynchronous event-driven communication between services. Instead of forcing every service to call every other service directly, the platform publishes events when significant business changes occur. This approach reduces coupling, improves flexibility, and allows different parts of the system to react to events at their own pace. The event consumer demonstrates this pattern by listening to the message queue and processing incoming notifications independently of the request that created them.

Key event types include:

- PRICE_UPDATED
- SEAT_RESERVED
- BOOKING_CONFIRMED
- BAGGAGE_STATUS_UPDATED
- FLIGHT_SCHEDULE_UPDATED

These events represent important business changes within the airline domain. `PRICE_UPDATED` communicates a change in flight pricing, `SEAT_RESERVED` indicates that a seat has been allocated, `BOOKING_CONFIRMED` represents a completed reservation, `BAGGAGE_STATUS_UPDATED` reflects a change in baggage handling status, and `FLIGHT_SCHEDULE_UPDATED` records modifications to flight timing, status, or gate information. In a distributed airline platform, these events help ensure that operational changes are visible across the system without requiring tightly coupled direct service calls.

This design supports eventual consistency, which means that the system may not update all dependent services at exactly the same moment, but it will converge to a consistent state shortly after the relevant events are processed. In practice, eventual consistency is appropriate for airline systems because many operational changes can be propagated asynchronously without blocking the user-facing workflow. This improves resilience and scalability while still preserving business correctness.

The event-driven model is particularly useful for airline systems because it allows the platform to separate transaction processing from downstream notifications and updates. For example, a booking can be confirmed while other services independently react to the booking event, such as updating baggage records or synchronising operational views. This separation improves maintainability and allows the platform to absorb changes more effectively as the system grows.

[Figure 5: RabbitMQ Dashboard]

[Figure 6: Event Consumer Logs]

## 8. AWS Free Tier Practical Implementation

In addition to the local Docker-based microservices platform, a Free Tier-safe AWS practical implementation was created in the `us-east-1` region. This AWS evidence demonstrates a serverless subset of the AeroLink system rather than the full production architecture. Its purpose is to show that the core cloud design can be expressed using managed AWS services in a way that is suitable for a student account and consistent with Free Tier constraints.

The AWS implementation uses API Gateway HTTP API as the public front door for the cloud subset. This service receives HTTP requests and routes them to AWS Lambda functions, which execute the application logic for the cloud evidence. DynamoDB is used as the managed persistence layer, providing a simple and scalable data store for flight and booking records. IAM supplies the execution role and inline policy required for least-privilege access to AWS resources. CloudWatch Logs provide runtime visibility into Lambda execution, while CloudTrail Event History provides audit evidence of resource activity and administrative actions.

The implemented AWS API routes are intentionally limited to the core demonstration flows required for the assignment evidence. These routes are:

- `GET /health`
- `GET /flights`
- `POST /flights`
- `GET /bookings`
- `POST /bookings`

The DynamoDB design is similarly focused and uses two tables. `AeroLinkFlights` stores flight records with `flight_id` as the partition key, while `AeroLinkBookings` stores booking records with `booking_id` as the partition key. This schema is deliberately simple so that the cloud demonstration remains practical, understandable, and within Free Tier-friendly limits.

It is important to distinguish this implementation from the target enterprise architecture. The AWS deployment does not reproduce the full containerised microservices stack in the cloud, nor does it claim a complete production deployment. Instead, it provides a practical subset that demonstrates the cloud-native pattern through a smaller serverless implementation. The full production architecture remains the broader design target, whereas this AWS version serves as evidence that the design principles can be realised using managed AWS services.

[Figure 7: AWS Lambda Function]

[Figure 8: API Gateway Public Health Endpoint]

[Figure 9: DynamoDB Flight and Booking Items]

[Figure 10: CloudWatch Logs]

## 9. Security and Compliance

Security in AeroLink is implemented at both the application and cloud-infrastructure levels. In the local Docker-based platform, authentication is based on JSON Web Tokens (JWTs), which are issued by the authentication service after successful login. The API Gateway validates Bearer tokens before forwarding protected requests, which ensures that only authenticated users can access restricted endpoints. Role-based access control is then applied to distinguish between the three application roles used in the platform: passenger, staff, and admin. This role model is important because it reflects the operational structure of an airline system, in which ordinary users should have limited access while operational staff require broader privileges.

The implementation demonstrates that missing token requests are blocked and that passengers are prevented from performing restricted actions such as flight creation or other privileged operations. This is a meaningful security control because it verifies that the gateway does not merely route traffic, but also enforces access policies before internal services are reached. In the AWS practical subset, security is supported through an IAM execution role with a least-privilege inline DynamoDB policy. This role limits the Lambda function to the specific database actions required by the serverless demonstration rather than granting broad account permissions.

Account safety controls were also considered. MFA was enabled for the AWS account to reduce the risk of unauthorised access, and a budget alert was configured to support responsible cost control and prevent accidental overuse of the Free Tier environment. CloudTrail Event History provides an audit trail for AWS activity, allowing resource creation and administrative actions to be reviewed after the fact. Together, these measures support traceability, privilege control, and safer account management.

The project also addresses encryption in transit and at rest at a design level. In the AWS implementation, API Gateway communicates over HTTPS, which provides encrypted transport for public requests. DynamoDB encryption at rest is enabled by default, which means data stored in the managed tables is protected without additional application-side encryption logic. These controls are appropriate for a cloud-facing airline platform because they protect credentials, requests, and stored records during transmission and persistence.

At a compliance level, the design can be discussed in relation to GDPR and PCI-DSS, even though the project is not a certified production compliance implementation. GDPR is relevant because airline platforms may process personal data such as names, contact details, and booking records, all of which require controlled access, appropriate retention, and transparency in handling. PCI-DSS is relevant where payment data would eventually be processed in a full enterprise version, although the present implementation does not include a full payment-processing workflow. The project therefore demonstrates compliance-aware design thinking rather than formal certification, which is appropriate for a student cloud prototype.

[Figure 11: Missing Token Blocked]

[Figure 12: Passenger RBAC Blocked]

[Figure 13: IAM Lambda DynamoDB Policy]

[Figure 14: CloudTrail Event History]

## 10. Fault Tolerance and Resilience

Fault tolerance and resilience are addressed through a combination of implemented controls and target-design principles. In the local platform, the booking service includes retry logic when calling the flight service, which helps the system tolerate transient communication failures and temporary service unavailability. This is a practical resilience measure because booking workflows often depend on more than one service, and network delays or brief outages should not necessarily cause the user operation to fail immediately.

The API Gateway also contributes to resilience by decoupling clients from internal service locations. Because clients communicate with one public entry point rather than directly with individual services, backend services can be replaced, scaled, or monitored without changing the external interface. Health checks further improve resilience by making it possible to determine whether services and downstream dependencies are operating correctly. Docker container isolation also supports resilience in a local sense because service failures remain contained within their respective containers rather than collapsing the entire runtime environment.

Event-driven decoupling with RabbitMQ adds another layer of resilience. By publishing events such as price changes or baggage updates asynchronously, the system avoids hard dependencies between every participating service. This reduces direct coupling and allows consumers to process messages independently. In distributed systems, this is valuable because it helps the platform continue functioning even when not every service is ready to act immediately on a change.

The AWS practical subset also demonstrates managed resilience. Lambda provides a managed execution environment that automatically handles function invocation at the service level, while DynamoDB offers managed availability and removes the need for the student to operate a database server directly. API Gateway provides managed routing for public HTTP requests, which further reduces operational overhead. These services do not eliminate failure, but they do shift some of the resilience burden to AWS-managed components.

For the target enterprise architecture, the report should make clear that multi-AZ deployment, multi-region replication, auto-scaling, load balancing, and formal disaster recovery are part of the intended production design rather than fully implemented features in this submission. These patterns are important because airline systems are expected to continue operating during infrastructure faults, regional outages, or sudden demand increases. A circuit breaker pattern is also a sensible future enhancement because it can prevent repeated calls to a failing dependency and improve graceful degradation in the presence of cascading failures.

[Figure 15: Gateway Health Check Showing Downstream Services]

## 11. Testing Strategy and Results

The testing strategy for AeroLink is layered so that the system can be evaluated at multiple levels of correctness and performance. Unit testing is used to validate individual service behaviour in isolation, including authentication, flight operations, baggage handling, and schedule management. Integration testing extends this by exercising the full gateway-led workflow across services, which is essential for a distributed application where the interfaces between components are as important as the components themselves.

Postman API testing provides a practical way to demonstrate and document the HTTP routes exposed by the API Gateway. This is useful for assignment evidence because it shows the expected user-facing flows in a clear and reproducible manner. Locust normal load testing then evaluates the system under concurrent use, focusing on a realistic workload rather than an intentionally failing one. Locust stress or capacity testing is used separately to demonstrate how the booking path behaves when capacity is deliberately exhausted.

The observed results show that 9 pytest tests passed successfully. In addition, the normal Locust load test produced 2935 requests with 0% failures and an average response time of 69.83 ms. These results indicate that the normal operational path of the system is stable under the tested load and that the load-test flight configuration avoided artificial seat-exhaustion noise.

The stress or capacity test serves a different purpose. By using a low-seat flight, it demonstrates that booking failures occur when seat capacity is exhausted, which helps prevent overbooking and confirms that the application behaves predictably under resource pressure. In other words, the failure in the stress scenario is not a defect in the test; it is evidence that the system enforces its capacity constraint correctly.

[Figure 16: Pytest 9 Tests Passed]

[Figure 17: Postman API Test Results]

[Figure 18: Locust Normal Load Test]

[Figure 19: Locust Stress Capacity Test]

## 12. Monitoring and Observability

Observability is implemented in the local system through `/health` and `/metrics` endpoints, request ID middleware, structured logs, and RabbitMQ event logs. The health endpoint provides a quick way to verify that a service is running and to identify whether dependencies are available. The metrics endpoint exposes request counters, error counters, and uptime information, which gives a lightweight view of runtime behaviour. The request ID middleware adds or propagates an `X-Request-ID` value so that a request can be traced across services, while structured logs capture the service name, request ID, method, path, status code, and duration. Event consumer logs add further visibility into asynchronous processing by showing when messages have been received and handled.

On AWS, CloudWatch Lambda logs provide runtime visibility into the serverless implementation, including function execution output and operational messages. API Gateway metrics provide another level of insight by showing how the public HTTP API is being used and whether requests are being processed successfully. CloudTrail audit events complement these operational views by recording administrative actions and resource activity within the AWS account.

Together, these observability mechanisms support fault diagnosis, traceability, and evaluation. If a request fails, the developer can trace it through the gateway, inspect the request ID in the logs, verify whether the service health endpoints are still responding, and check the AWS logs or audit history if the issue occurred in the cloud subset. This is particularly valuable in distributed systems because problems are often caused by interactions between services rather than by a single isolated component. Observability therefore becomes an enabling capability for both debugging and evidence-based evaluation.

[Figure 20: Local Gateway Health Response]

[Figure 21: Local Gateway Metrics Response]

[Figure 22: Request ID Header Proof]

[Figure 23: CloudWatch Lambda Logs]

[Figure 24: API Gateway Metrics]

## 13. Challenges and Limitations

The AeroLink project was intentionally developed as an academic prototype rather than a production airline platform, and this choice introduces several important limitations. The AWS Free Tier approach places natural constraints on scale, service breadth, and operational scope because the deployment must remain cost-controlled and lightweight enough to be feasible within a student environment. For that reason, the AWS implementation is a serverless subset of the broader design rather than a full production estate. It demonstrates the target cloud pattern, but it does not attempt to reproduce every operational dependency or enterprise control.

The local implementation also has deliberate limitations. SQLite is used for local persistence because it is simple, portable, and suitable for development and testing, but it is not intended to represent a production-grade relational database platform. RabbitMQ is used as the local event broker to demonstrate asynchronous communication, yet the full enterprise version would typically use managed AWS messaging services in the cloud. Similarly, the local environment does not include a full production frontend, which means the emphasis remains on service behaviour, API integration, and evidence generation rather than on a complete customer-facing application layer.

In addition, the project does not claim full multi-region deployment or full ECS/Fargate cloud deployment. These are part of the target production design, but they are outside the scope of the implemented evidence set. This distinction is important because the assignment requires a strong academic prototype and cloud implementation discussion, not a fully deployed commercial airline platform. The limitations are therefore acceptable because they reflect a controlled and realistic student-scale implementation that still demonstrates the central distributed systems concepts.

The gap between prototype and enterprise production design is also significant and should be acknowledged explicitly. The prototype proves that the architecture can be decomposed into services, tested, observed, and mapped to AWS components, but a commercial deployment would require additional layers of automation, resilience, security hardening, governance, and operational maturity. In this sense, the project should be understood as a credible foundation for production development rather than as a final production solution.

## 14. Future Enhancements

Future development of AeroLink would build on the current prototype by moving the design closer to enterprise-grade cloud operations. A deployment on ECS/Fargate would allow the containerised microservices to run as a fully managed cloud workload, providing better alignment with production microservice practice, improved operational control, and more realistic scaling behaviour than a local Docker environment.

An Aurora migration would strengthen the relational data layer for production use, particularly where booking, flight, and customer records require stronger transactional guarantees and richer relational modelling. In contrast, DynamoDB would remain appropriate for high-throughput service data or workloads that benefit from managed horizontal scalability and low-latency access. The value of retaining both options in the architecture is that the data store can be matched to the access pattern rather than forcing every workload into a single persistence model.

For asynchronous integration in AWS, EventBridge, SQS, or SNS could replace RabbitMQ in a managed manner. This would reduce operational burden and improve cloud-native alignment, while still supporting event publication and consumer-driven processing. Likewise, Cognito integration would provide managed identity services and could simplify authentication flows while strengthening identity governance in a production deployment.

At the security edge, WAF and Shield would add better protection against common attack patterns and availability threats. WAF would support request filtering and rule-based protection at the application perimeter, while Shield would contribute to resilience against distributed denial-of-service risks. In operational terms, these services would improve the defensive posture of the platform in a real internet-facing deployment.

The project would also benefit from CI/CD using GitHub Actions. Automated build, test, and deployment workflows would reduce manual release risk and make the system more repeatable and maintainable. Infrastructure as Code with Terraform or CloudFormation would further strengthen reproducibility by making the cloud environment declarative, version-controlled, and easier to audit. These tools would also support environment consistency across development, testing, and production.

In a mature production design, multi-region failover and disaster recovery would be necessary to support business continuity. Such a design would help ensure that a regional outage does not interrupt airline operations for users in other regions. Finally, a circuit breaker implementation would be a useful application-level enhancement because it can prevent repeated calls to failing dependencies and allow the system to degrade more gracefully under partial failure conditions.

Taken together, these enhancements would move AeroLink from a strong academic prototype toward a more complete enterprise cloud platform. They are best understood as the next stage of development rather than as features already implemented in the current submission.

## 15. Conclusion

The AeroLink project demonstrates how an airline systems platform can be transformed from a monolithic design into a distributed cloud-oriented solution that is more suitable for modern enterprise requirements. Through the local Docker microservices implementation, the project shows that core airline functions can be separated into independently manageable services connected through an API Gateway and event-driven messaging. Through the AWS Free Tier evidence, it also shows that the same design can be mapped onto managed cloud services using API Gateway HTTP API, Lambda, DynamoDB, IAM, CloudWatch, and CloudTrail.

The final solution addresses the assignment requirements in a coherent and evidence-based way. High availability is considered through health monitoring and service separation; scalability is supported through microservice decomposition and managed cloud services; fault tolerance is improved through retries, asynchronous messaging, and managed AWS components; real-time synchronisation is enabled by event publication and consumption; security is addressed through JWT authentication, RBAC, IAM least privilege, MFA, and audit logging; API integration is provided through a documented gateway-led interface; monitoring is demonstrated through health checks, metrics, logs, and traceability; and testing is evidenced through unit, integration, Postman, and Locust results.

Although the project is not a fully production-ready airline platform, it is a credible and well-supported academic prototype with a clear production path. The combination of local microservices evidence and AWS Free Tier evidence shows that the design is technically sound, logically structured, and aligned with cloud-native development principles. As a result, AeroLink provides a strong foundation for future production development and a convincing demonstration of distributed cloud application design.

## 16. References

- Amazon Web Services (2026) *Amazon API Gateway Developer Guide*. Available at: https://docs.aws.amazon.com/apigateway/ (Accessed: 15 May 2026).
- Amazon Web Services (2026) *AWS Lambda Developer Guide*. Available at: https://docs.aws.amazon.com/lambda/ (Accessed: 15 May 2026).
- Amazon Web Services (2026) *Amazon DynamoDB Developer Guide*. Available at: https://docs.aws.amazon.com/dynamodb/ (Accessed: 15 May 2026).
- Amazon Web Services (2026) *Amazon CloudWatch User Guide*. Available at: https://docs.aws.amazon.com/cloudwatch/ (Accessed: 15 May 2026).
- Amazon Web Services (2026) *AWS CloudTrail User Guide*. Available at: https://docs.aws.amazon.com/cloudtrail/ (Accessed: 15 May 2026).
- Amazon Web Services (2026) *AWS Identity and Access Management User Guide*. Available at: https://docs.aws.amazon.com/IAM/ (Accessed: 15 May 2026).
- Docker, Inc. (2026) *Docker Documentation*. Available at: https://docs.docker.com/ (Accessed: 15 May 2026).
- FastAPI (2026) *FastAPI Documentation*. Available at: https://fastapi.tiangolo.com/ (Accessed: 15 May 2026).
- RabbitMQ (2026) *RabbitMQ Documentation*. Available at: https://www.rabbitmq.com/documentation.html (Accessed: 15 May 2026).
- OWASP Foundation (2023) *OWASP API Security Top 10*. Available at: https://owasp.org/www-project-api-security/ (Accessed: 15 May 2026).
- AWS Academy (2026) *Cloud Foundations module notes and lecture materials*. COMP60010 Enterprise Cloud and Distributed Web Applications, module teaching materials.

## 17. Appendices

Suggested appendix content:

- Evidence screenshot checklist
- API routes list
- Test results summary
- AWS screenshots
- Configuration and deployment files

Detailed screenshots are stored in the evidence folder and indexed in [docs/EVIDENCE_INDEX.md](docs/EVIDENCE_INDEX.md). This appendix should be used to organise the final evidence set and cross-reference the relevant figures used in the report.

## Suggested Evidence to Include in the Final Report

- Docker containers running
- API Gateway Swagger/OpenAPI screen
- JWT login and RBAC screenshots
- RabbitMQ dashboard and event consumer logs
- Pytest result showing 9 tests passed
- Postman collection screenshots
- Locust normal load test result
- Locust stress or capacity test result
- Gateway /health and /metrics responses
- AWS evidence screenshots for API Gateway, Lambda, DynamoDB, CloudWatch, and CloudTrail
