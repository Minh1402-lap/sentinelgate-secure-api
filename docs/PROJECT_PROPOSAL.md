# SentinelGate Project Proposal

## Project Overview

SentinelVault is the protected application: a private cloud file vault where users will store and manage files. Its application code, authentication, storage behavior, and primary data remain separate from the security system that observes and protects it.

SentinelGate is the separate defense system planned for SentinelVault. It will receive security-relevant signals, detect suspicious behavior, evaluate defensive policy, and coordinate controlled responses without becoming part of SentinelVault's normal business logic.

## Objectives

- Build a clear, learnable foundation for a containerized private file-storage application and its defense system.
- Keep SentinelVault and SentinelGate separated so each can evolve and be tested independently.
- Establish explicit trust boundaries and least-privilege communication paths.
- Produce structured security events that can later support detection and investigation.
- Add defensive automation gradually, with verification, bounded actions, and rollback in mind.

## MVP Scope

The planned minimum viable product includes:

- A private SentinelVault web application behind a gateway.
- Authentication and basic private file-management workflows.
- A dedicated application database accessible only to the protected application.
- Structured security-event generation for selected authentication and application activity.
- Initial SentinelGate detection for a small, documented scenario such as repeated failed logins.
- Policy evaluation and a safe, temporary defensive response with auditability and rollback.
- Security tests that exercise the protected path and verify the expected defensive behavior.

This scaffold establishes only the repository, documentation, and local MySQL development foundation. It does not implement the MVP features.

## Intentionally Out of Scope

- Production deployment, high availability, disaster recovery, or multi-region operation.
- A complete security information and event management platform.
- Machine-learning detection, broad threat intelligence, or autonomous offensive actions.
- Full malware scanning, content inspection, data-loss prevention, or enterprise compliance certification.
- Mobile or desktop synchronization clients and public file sharing.
- Billing, organization administration, or multi-tenant enterprise features.
- Database tables, Prisma model changes, migrations, backend routes, and business logic in this foundation step.
