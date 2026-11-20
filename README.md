# Tessera

<p align="center">
  <strong>A secure, self-hosted collaboration platform built from an architecture-first foundation.</strong>
</p>

<p align="center">
  <img alt="Sprint 3 verified" src="https://img.shields.io/badge/Sprint_3-verified-00c853?style=for-the-badge" />
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

- interactive React 19 Kanban board with workspace setup and task transitions;
- NestJS 12 API with health, architecture, workspace, project, and task endpoints;
- shared Zod schemas, DTOs, and domain-event contracts;
- domain rules for WIP limits and task state transitions;
- migrated Factory Method, Builder, Singleton, and State patterns;
- PostgreSQL persistence through Drizzle ORM with versioned migrations;
- transactional project setup with a Kanban board and four default columns;
- sequential task keys and database-backed conflict/not-found handling;
- Keycloak OIDC login, signed access-token verification, and project role checks;
- workspace/project membership persisted in PostgreSQL;
- searchable Kanban with drag and drop, overview, deadlines, team and audit screens in a shared responsive glass interface;
- owner-confirmed project deletion and role-checked member removal with transactional task unassignment;
- task editing, assignees, deadlines, comments and small downloadable attachments;
- automated unit and E2E tests plus lint, typecheck, and production builds;
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

    API -->|Drizzle ORM · migrations| PostgreSQL
    API -. cache and queues .-> Valkey
    API -. attachments .-> Garage
    Web -->|OIDC code flow + PKCE| Keycloak
    API -->|JWT signature via JWKS| Keycloak
    API -. notifications .-> Mailpit
```

PostgreSQL and Keycloak now form an authenticated application slice. Dashed connections identify integrations scheduled for future sprints.

## Persistence vertical slice

Sprint 2 connects the application core to PostgreSQL without leaking ORM details into the application layer. Controllers validate shared Zod contracts, services depend on a repository port, and the Drizzle adapter owns transactions and database error translation.

| Method | Endpoint                                | Outcome                                            |
| ------ | --------------------------------------- | -------------------------------------------------- |
| `POST` | `/api/workspaces`                       | Creates a workspace                                |
| `POST` | `/api/workspaces/:workspaceId/projects` | Creates a project, board, and four Kanban columns  |
| `GET`  | `/api/workspaces/:workspaceId/projects` | Lists persisted projects                           |
| `POST` | `/api/projects/:projectId/tasks`        | Creates a task with a sequential key such as TES-1 |
| `GET`  | `/api/projects/:projectId/tasks`        | Lists persisted project tasks                      |

The initial migration creates seven constrained tables; Sprint 3 adds `workspace_memberships`. E2E tests run against the real containerized database and remove their fixtures afterward.

## Identity and project roles

The `tessera` realm is imported from `infra/keycloak/tessera-realm.json` on first Keycloak startup. The browser uses Authorization Code + PKCE. The API validates JWT signature, issuer, expiry, algorithm and the authorized client (`azp`) against Keycloak's JWKS. Roles are stored per project in PostgreSQL; a role embedded in a token never grants project access by itself.

| Project role | Read board | Create, edit, move and discuss tasks | Delete tasks and manage access | Delete project |
| ------------ | ---------- | ------------------------------------ | ------------------------------ | -------------- |
| OWNER        | Yes        | Yes                                  | Yes                            | Yes            |
| ADMIN        | Yes        | Yes                                  | Yes                            | No             |
| MEMBER       | Yes        | Yes                                  | No                             | No             |
| VIEWER       | Yes        | No                                   | No                             | No             |

The creator owns each new workspace and project. Workspace roles control project creation, while project roles control access to each board. An owner or admin can add a user by email after that user signs in once. Older projects made before Sprint 3 have no owner assigned; they are intentionally not exposed to a newly authenticated account.

On the project picker, only the owner can delete a project by entering its code. This permanently removes the project and its board, tasks, comments, attachments and audit records. Owners can remove any non-owner project member; admins can remove members and viewers. Removal revokes project access and clears that user's task assignments while increasing task versions and recording the changes in the audit log. The Kanban drag interaction accepts any other column with available WIP capacity; the status selector remains available for keyboard use.

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
pnpm auth:env # for an existing .env; adds only missing local demo passwords
```

Start the complete stack and wait for its health checks:

```bash
sudo docker compose up -d --wait --wait-timeout 240
sudo docker compose ps
pnpm db:migrate
pnpm dev
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

Open <http://localhost:5173> and select **Увійти через Keycloak**. The local demo usernames are `tessera-owner`, `tessera-member`, and `tessera-viewer`; their distinct passwords are in the gitignored `.env` (`TESSERA_DEMO_*_PASSWORD`). Sign in once with each account, then use **Команда → Надати доступ** as the project owner to add the member/viewer by email. Demo credentials are for localhost development only.

Keycloak startup import skips an existing `tessera` realm; editing its JSON later does not overwrite user data. Existing projects remain preserved in PostgreSQL.

On an existing local install, apply the branded Ukrainian login theme once:

```bash
sudo docker compose up -d --wait keycloak
pnpm auth:theme
```

New realms get the theme from the import. The theme extends Keycloak's built-in login flow and is mounted from `infra/keycloak/themes/tessera`.

## Coursework demo

1. As the owner, create a project with code `PAY`, then create a task with an assignee, deadline and story-point estimate.
2. Open the task to write a comment and attach a small file. Coursework attachments are stored in PostgreSQL with a SHA-256 checksum, with a 2 MiB limit per file and up to 10 files per task.
3. Move four tasks to **У роботі** and try moving a fifth. The server rejects the fifth request with HTTP 409 and preserves the board.
4. In **Журнал змін**, show that successful moves, edits, comments, and attachments were recorded. Task changes and audit rows commit in the same transaction.
5. Open **Огляд** to relate the operation to the four layers. Repeat with a viewer account to demonstrate read-only access.

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
pnpm db:check
pnpm test:e2e
```

## Repository layout

```text
apps/
  api/       NestJS vertical slices, Drizzle schema, and SQL migrations
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
  <img alt="Roadmap progress: 3 of 6 milestones complete" src="https://img.shields.io/badge/Roadmap-3_of_6_milestones_complete-00c853?style=for-the-badge" />
</p>

| Status    | Milestone                         | Outcome                                                            |
| --------- | --------------------------------- | ------------------------------------------------------------------ |
| ✅ Done   | **Sprint 1A · Architecture**      | Monorepo, domain core, shared contracts, and design patterns       |
| ✅ Done   | **Sprint 1B · Infrastructure**    | Reproducible, secure, and fully verified self-hosted stack         |
| ✅ Done   | **Sprint 2 · Persistence**        | PostgreSQL integration, ORM schema, migrations, and repositories   |
| ✅ Done   | **Sprint 3 · Identity**           | Keycloak OIDC authentication and role-based access control         |
| ◌ Planned | **Sprint 4 · Platform Services**  | S3 attachments, audit history, and notification delivery           |
| ◌ Planned | **Sprint 5 · Product Experience** | Kanban UI enhancements, accessibility, and real-time collaboration |

**Coursework release:** the authenticated Kanban slice includes an activity log and bounded PostgreSQL attachments. Garage-backed storage, external notifications and real-time collaboration remain part of the bachelor roadmap.

---

Built as an architecture-focused coursework project with a clear path to a production-grade bachelor thesis platform.
