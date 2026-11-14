# Tessera

<p align="center">
  <strong>A secure, self-hosted collaboration platform built from an architecture-first foundation.</strong>
</p>

<p align="center">
  <img alt="Sprint 1B verified" src="https://img.shields.io/badge/Sprint_1B-verified-00c853?style=for-the-badge" />
</p>

<p align="center">
  <img alt="Node.js 24 LTS" src="https://img.shields.io/badge/Node.js-24_LTS-5FA04E?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&amp;logo=react&amp;logoColor=111827" />
  <img alt="NestJS 12" src="https://img.shields.io/badge/NestJS-12-E0234E?style=flat-square&amp;logo=nestjs&amp;logoColor=white" />
  <img alt="Docker Compose" src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&amp;logo=docker&amp;logoColor=white" />
  <img alt="Last commit" src="https://img.shields.io/github/last-commit/uddorn/Tessera?style=flat-square&amp;logo=github" />
</p>

Tessera evolves a coursework architectural MVP into a bachelor-level product without discarding its domain core. The repository combines a typed pnpm monorepo, explicit architectural boundaries, reusable contracts, tested design patterns, and a reproducible self-hosted infrastructure stack.

## What is working now

- React 19 boundary application powered by Vite;
- NestJS 12 API with health and architecture endpoints;
- shared Zod schemas, DTOs, and domain-event contracts;
- domain rules for WIP limits and task state transitions;
- migrated Factory Method, Builder, Singleton, and State patterns;
- six passing automated tests plus lint, typecheck, and production builds;
- five healthy Docker services with persistent data and loopback-only ports.

## Architecture

```mermaid
flowchart LR
    User([User]) --> Web[React 19 Web]
    Web --> API[NestJS 12 API]
    API <--> Shared[Shared Zod Contracts]

    subgraph Infrastructure[Docker Compose · verified]
        PostgreSQL[(PostgreSQL 18)]
        Valkey[(Valkey 9)]
        Garage[(Garage S3)]
        Keycloak[Keycloak IAM]
        Mailpit[Mailpit SMTP]
    end

    API -. next integrations .-> PostgreSQL
    API -. cache and queues .-> Valkey
    API -. attachments .-> Garage
    API -. OIDC and RBAC .-> Keycloak
    API -. notifications .-> Mailpit
```

The infrastructure is already operational. Dashed connections identify the application integrations scheduled for the next vertical slices.

## Verified infrastructure

| Service    | Pinned image                       | Purpose                             | Local endpoint          | Status     |
| ---------- | ---------------------------------- | ----------------------------------- | ----------------------- | ---------- |
| PostgreSQL | `postgres:18.7-alpine3.24`         | Tessera and Keycloak databases      | `localhost:5432`        | ✅ Healthy |
| Valkey     | `valkey/valkey:9.1.3-alpine3.24`   | Cache, sessions, and future queues  | `localhost:6379`        | ✅ Healthy |
| Garage     | `dxflrs/garage:v2.5.0`             | S3-compatible attachment storage    | `http://localhost:3900` | ✅ Healthy |
| Keycloak   | `quay.io/keycloak/keycloak:26.8.2` | OIDC identity and access management | `http://localhost:8080` | ✅ Healthy |
| Mailpit    | `axllent/mailpit:v1.33.1`          | Safe local email capture            | `http://localhost:8025` | ✅ Healthy |

The Sprint 1B acceptance check confirmed PostgreSQL connectivity, a dedicated Keycloak database, authenticated Valkey access, a healthy Garage node with the `tessera-attachments` bucket, OpenID discovery, Mailpit HTTP access, and five persistent Docker volumes.

## Quick start

### Requirements

- Node.js 24 LTS;
- pnpm 11.25 or compatible;
- Docker Engine with Docker Compose;
- Linux or WSL2 for the documented development workflow.

### Application

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

| Component        | URL                                      |
| ---------------- | ---------------------------------------- |
| Web application  | <http://localhost:5173>                  |
| API health       | <http://localhost:3001/api/health>       |
| API architecture | <http://localhost:3001/api/architecture> |

### Infrastructure

Generate unique local secrets. The command deliberately refuses to overwrite an existing `.env`:

```bash
pnpm infra:env
```

Start the complete stack and wait for its health checks:

```bash
sudo docker compose up -d --wait --wait-timeout 240
sudo docker compose ps
```

Useful verification commands:

```bash
sudo docker compose exec -T postgres \
  psql -U tessera -d tessera -c "SELECT current_database(), current_user;"

sudo docker compose exec -T valkey sh -lc \
  'valkey-cli --no-auth-warning -a "$VALKEY_PASSWORD" ping'

sudo docker compose exec -T garage /garage status
```

Stop the stack without deleting persistent data:

```bash
sudo docker compose stop
```

> [!CAUTION]
> `docker compose down --volumes` permanently deletes the local databases, object storage, cache, and captured mail.

## Security-minded development defaults

- generated secrets stay in a gitignored `.env` file;
- the generator creates high-entropy credentials and never prints them;
- published infrastructure ports bind to `127.0.0.1` only;
- containers communicate through the isolated `tessera-backend` network;
- service versions are pinned and startup is guarded by health checks;
- persistent data lives in named Docker volumes.

The current Keycloak configuration uses development mode and is intended for local development only. A production deployment will add TLS, hardened hostnames, secret management, and an optimized Keycloak image.

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Repository layout

```text
apps/
  api/       NestJS boundary, application, domain, and infrastructure layers
  web/       React boundary application
packages/
  shared/    Zod schemas, DTOs, and domain-event contracts
infra/
  garage/    Single-node S3-compatible storage configuration
  postgres/  Idempotent database bootstrap assets
scripts/
  create-local-env.mjs
compose.yaml
```

## Roadmap

<p align="center">
  <img alt="Roadmap progress: 2 of 5 milestones complete" src="https://img.shields.io/badge/Roadmap-2_of_5_milestones_complete-00c853?style=for-the-badge" />
</p>

| Status    | Milestone                         | Outcome                                                          |
| --------- | --------------------------------- | ---------------------------------------------------------------- |
| ✅ Done   | **Sprint 1A · Architecture**      | Monorepo, domain core, shared contracts, and design patterns     |
| ✅ Done   | **Sprint 1B · Infrastructure**    | Reproducible, secure, and fully verified self-hosted stack       |
| 🎯 Next   | **Sprint 2 · Persistence**        | PostgreSQL integration, ORM schema, migrations, and repositories |
| ◌ Planned | **Sprint 3 · Identity**           | Keycloak OIDC authentication and role-based access control       |
| ◌ Planned | **Sprint 4 · Platform Services**  | S3 attachments, audit history, and notification delivery         |
| ◌ Planned | **Sprint 5 · Product Experience** | Kanban UI, accessibility, and real-time collaboration            |

**Current focus:** Sprint 2 turns the verified infrastructure into the first complete end-to-end vertical slice.

---

Built as an architecture-focused coursework project with a clear path to a production-grade bachelor thesis platform.
