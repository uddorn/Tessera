import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env");
const content = readFileSync(file, "utf8");
const missing = [
  "TESSERA_DEMO_OWNER_PASSWORD",
  "TESSERA_DEMO_MEMBER_PASSWORD",
  "TESSERA_DEMO_VIEWER_PASSWORD",
].filter((key) => !new RegExp(`^${key}=`, "m").test(content));
if (missing.length) {
  appendFileSync(
    file,
    `\n# Local Keycloak demo users\n${missing.map((key) => `${key}=${randomBytes(24).toString("base64url")}`).join("\n")}\n`,
    { mode: 0o600 },
  );
}
console.log(`Auth environment ready; added ${missing.length} local secret(s).`);
