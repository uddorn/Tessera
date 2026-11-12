# Tessera

Tessera is a secure, self-hosted collaborative project-management platform. The repository evolves the coursework architectural MVP into a bachelor-level product without rewriting the domain core.

## Sprint 1A status

- pnpm workspace monorepo;
- `apps/api`: NestJS API with the migrated domain model and GoF patterns;
- `apps/web`: React 19 and Vite boundary application;
- `packages/shared`: Zod contracts shared by API and web;
- unit tests for WIP limits, State, Factory Method, Builder, and shared DTO validation;
- production builds for all workspaces.

Docker infrastructure is intentionally scheduled for Sprint 1B on the home WSL environment, where PostgreSQL, Valkey, Garage, Keycloak, and Mailpit can be started and verified together.

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
```
