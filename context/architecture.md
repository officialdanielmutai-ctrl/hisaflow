## Architecture

### System Structure
- **Frontend:** React SPA communicating via REST & WebSocket.
- **Backend:** NestJS microservices (Flow Service, Executor Service, Auth Service).
- **Storage:** PostgreSQL (operational data), Redis (queue and cache), MinIO (flow artifacts).
- **Message Broker:** RabbitMQ for inter-service communication and job dispatching.

### Boundaries
- API Gateway handles authentication and routing.
- Each service runs in its own Docker container.
- Database access via Prisma ORM.

### Storage Model
- **Flow definitions:** JSON stored as Prisma model with versioning.
- **Execution logs:** partitioned table by date.
- **User data:** separate schema.

### Invariants
- Flow name must be unique per workspace.
- Execution state transitions: pending → running → completed / failed.
- No direct DB writes from frontend.
