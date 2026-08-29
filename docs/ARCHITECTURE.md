# Planned Architecture

## Components

### SentinelVault protected application

- **Gateway:** The future public entry point. It will terminate incoming web traffic and forward only allowed requests to the protected application.
- **Protected app:** The private file-vault application. It will own authentication, file workflows, and access to SentinelVault application data.
- **Application database:** The MySQL database used by SentinelVault. The development service in `compose.yaml` is the initial infrastructure placeholder for this database.
- **File storage:** A future private storage component for user file contents. Its design and implementation are outside this scaffold.

### SentinelGate defense system

- **Security-event boundary:** Structured events will cross from SentinelVault into SentinelGate without granting the defense system unrestricted access to application internals.
- **Detection:** Future detectors will identify documented suspicious patterns in security events.
- **Policy evaluation:** A separate policy layer will decide whether a proposed response is allowed and appropriately scoped.
- **Defender:** The response component will execute approved, reversible defensive actions and record their outcomes.
- **Defense database:** A future data store for security events, detection state, policies, response history, and audit evidence.

## Trust Boundaries

1. **External client to gateway:** All client input is untrusted. Only the gateway is intended to accept public traffic.
2. **Gateway to protected app:** The protected app remains private and accepts traffic only through the controlled gateway path.
3. **Protected app to application database:** Database access is private, credentialed, and limited to SentinelVault's application needs.
4. **Protected app to SentinelGate:** Security events are treated as structured, validated messages across a system boundary. Event submission must not provide a path to invoke arbitrary defensive actions.
5. **SentinelGate to response targets:** Defensive actions require explicit policy approval, narrow permissions, audit records, and a rollback or expiry strategy where applicable.
6. **Administrative access:** Operator access to application and defense systems is separate from normal user traffic and should use dedicated credentials and least privilege.

## Database Separation

SentinelVault's application database and SentinelGate's future defense database have different owners and purposes and must remain separate.

The **application database** stores SentinelVault business data, such as future user, authentication, file-metadata, and authorization records. SentinelVault owns its schema and migrations. SentinelGate must not use this database as its event store or modify application records directly as a shortcut for enforcement.

The **defense database** will store security-focused data such as normalized events, detection state, policy decisions, response actions, and audit history. SentinelGate will own its schema and lifecycle. The defense database is planned only; it is not created by the current Compose foundation.

Any future data flow between these domains should use narrow, documented interfaces rather than shared tables or shared database credentials. This separation limits compromise impact, clarifies ownership, and lets security retention and access rules differ from application requirements.

## Current Foundation Boundary

The current repository foundation defines one local MySQL 8.4 service for SentinelVault development. It binds only to `127.0.0.1:3307`, persists data in a named volume, and joins an internal backend network. No tables, Prisma changes, migrations, routes, defense database, or automated responses are included yet.
