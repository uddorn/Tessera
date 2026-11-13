# Tessera

Tessera is a secure, self-hosted collaborative project-management platform. The repository evolves the coursework architectural MVP into a bachelor-level product without rewriting the domain core.

## Current foundation

- pnpm workspace monorepo;
- `apps/api`: NestJS API with the migrated domain model and GoF patterns;
- `apps/web`: React 19 and Vite boundary application;
- `packages/shared`: Zod contracts shared by API and web;
- unit tests for WIP limits, State, Factory Method, Builder, and shared DTO validation;
- production builds for all workspaces.
- local Docker Compose infrastructure for PostgreSQL, Valkey, Garage, Keycloak, and Mailpit.

## Requirements

- Node.js 24 LTS or newer;
- pnpm 11 or newer;
- Docker with Compose for Sprint 1B.

## Local development

```powershell
pnpm install
pnpm dev
```

- Web: <http://localhost:5173>
- API health: <http://localhost:3001/api/health>
- API architecture: <http://localhost:3001/api/architecture>

## Local infrastructure

Generate a local `.env` containing unique development secrets. The command refuses to overwrite an existing file:

```bash
pnpm infra:env
```

Start the infrastructure from WSL. Ports are published only on the local loopback interface:

```bash
sudo docker compose up -d --wait
sudo docker compose ps
```

Available services:

- PostgreSQL: `localhost:5432`;
- Valkey: `localhost:6379`;
- Garage S3 API: <http://localhost:3900>;
- Garage admin API: <http://localhost:3903>;
- Keycloak: <http://localhost:8080>;
- Mailpit SMTP: `localhost:1025`;
- Mailpit UI: <http://localhost:8025>.

Inspect Garage and PostgreSQL:

```bash
sudo docker compose exec garage /garage status
sudo docker compose exec postgres psql -U tessera -d tessera -c "select version();"
```

Stop containers without deleting their data:

```bash
sudo docker compose stop
```

Remove containers and the internal network while preserving named volumes:

```bash
sudo docker compose down
```

Only when local infrastructure data may be permanently deleted:

```bash
sudo docker compose down --volumes
```

## Quality gates

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## Repository structure

```text
apps/
  api/       NestJS application, domain core and design patterns
  web/       React boundary application
packages/
  shared/    Zod schemas, DTOs and domain-event contracts
infra/
  garage/    Single-node S3-compatible storage configuration
  postgres/  Database initialization scripts
```
