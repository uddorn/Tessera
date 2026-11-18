import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const randomBase64Url = (bytes = 24) =>
  randomBytes(bytes).toString("base64url");
const randomHex = (bytes = 32) => randomBytes(bytes).toString("hex");

const postgresPassword = randomBase64Url();
const valkeyPassword = randomBase64Url();
const keycloakPassword = randomBase64Url();
const garageAccessKey = `GK${randomHex(16)}`;
const garageSecretKey = randomHex(32);

const envFile = `# Generated local-only configuration. Never commit this file.
NODE_ENV=development
PORT=3001
WEB_ORIGIN=http://localhost:5173

POSTGRES_DB=tessera
POSTGRES_USER=tessera
POSTGRES_PASSWORD=${postgresPassword}
DATABASE_URL=postgresql://tessera:${postgresPassword}@localhost:5432/tessera

VALKEY_PASSWORD=${valkeyPassword}
VALKEY_URL=redis://:${valkeyPassword}@localhost:6379

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=${keycloakPassword}
KEYCLOAK_ISSUER=http://localhost:8080/realms/tessera
KEYCLOAK_CLIENT_ID=tessera-web
TESSERA_DEMO_OWNER_PASSWORD=${randomBase64Url()}
TESSERA_DEMO_MEMBER_PASSWORD=${randomBase64Url()}
TESSERA_DEMO_VIEWER_PASSWORD=${randomBase64Url()}

GARAGE_RPC_SECRET=${randomHex(32)}
GARAGE_ADMIN_TOKEN=${randomBase64Url(32)}
GARAGE_METRICS_TOKEN=${randomBase64Url(32)}
GARAGE_ACCESS_KEY=${garageAccessKey}
GARAGE_SECRET_KEY=${garageSecretKey}
GARAGE_BUCKET=tessera-attachments
S3_ENDPOINT=http://localhost:3900
S3_REGION=garage

SMTP_HOST=localhost
SMTP_PORT=1025
`;

const target = resolve(process.cwd(), ".env");

try {
  writeFileSync(target, envFile, { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.log("Created .env with unique local development secrets.");
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EEXIST"
  ) {
    console.error(".env already exists; refusing to overwrite local secrets.");
    process.exitCode = 1;
  } else {
    throw error;
  }
}
