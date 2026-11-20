# Security baseline

Tessera is a local coursework environment. It is not configured for public
internet deployment. The controls below describe the current boundary and the
repeatable review process used during development.

## Trust boundaries

- **Identity:** Keycloak issues access tokens. The API validates the issuer,
  RS256 signature, audience client (`azp`), expiry and verified email before it
  creates or updates a local user record.
- **Authorisation:** every non-public API request must supply a bearer token.
  Workspace and project membership are checked in PostgreSQL for each protected
  operation. `VIEWER`, `MEMBER`, `ADMIN`, and `OWNER` are application roles;
  the frontend only mirrors those permissions and is not an access-control
  boundary.
- **Input and storage:** NestJS validates requests through shared Zod schemas,
  limits JSON request bodies to 3 MB, and reports application errors through a
  common filter. Attachment metadata and task activity are persisted with the
  project records.
- **Local infrastructure:** PostgreSQL, Valkey, Garage, Keycloak and Mailpit
  bind only to `127.0.0.1` in `compose.yaml`. Development secrets live in the
  ignored `.env` file and must never be committed.

## Repeatable security review

The repository exposes a focused Codex Security command:

```bash
pnpm security:scan
```

It scans the API, web client and infrastructure configuration, while excluding
generated dependencies and build artifacts. On the first run Codex Security
opens its sign-in flow. Authenticate locally; do not place an API key or access
token in this repository. To scan a larger change set, use the Codex Security
plugin and explicitly request focus on JWT validation, role-based access
control, file uploads and Docker configuration.

## Operational checks before a demonstration

1. Generate local secrets once with `pnpm infra:env` and keep `.env` private.
2. Start services with `sudo docker compose up -d --wait` and verify that every
   container is healthy.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm security:scan`.
4. Use a non-owner Keycloak test account to confirm that an unauthorised task
   change returns `403`.

## Disclosure

If you discover a vulnerability in this coursework repository, do not commit
secrets or an exploit. Record the affected component, reproduction steps and
the proposed remediation in a private issue or course report first.
