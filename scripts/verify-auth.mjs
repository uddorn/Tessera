import { loadEnvFile } from "node:process";
loadEnvFile(".env");

const base = "http://localhost:8080";
const form = new URLSearchParams({
  grant_type: "password",
  client_id: "admin-cli",
  username: process.env.KEYCLOAK_ADMIN,
  password: process.env.KEYCLOAK_ADMIN_PASSWORD,
});
const tokenResponse = await fetch(
  `${base}/realms/master/protocol/openid-connect/token`,
  {
    method: "POST",
    body: form,
  },
);
if (!tokenResponse.ok)
  throw new Error(`Keycloak admin login failed: HTTP ${tokenResponse.status}`);
const { access_token: token } = await tokenResponse.json();

async function adminGet(path) {
  const response = await fetch(`${base}/admin/realms/tessera/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Keycloak ${path}: HTTP ${response.status}`);
  return response.json();
}

const [users, clients] = await Promise.all([
  adminGet("users?max=100"),
  adminGet("clients?clientId=tessera-web"),
]);
const expected = ["tessera-owner", "tessera-member", "tessera-viewer"];
const missing = expected.filter(
  (name) => !users.some((user) => user.username === name),
);
if (missing.length)
  throw new Error(`Missing demo users: ${missing.join(", ")}`);
if (
  clients.length !== 1 ||
  !clients[0].publicClient ||
  !clients[0].standardFlowEnabled ||
  clients[0].directAccessGrantsEnabled
) {
  throw new Error(
    "Tessera browser client is not configured for public authorization-code login",
  );
}
console.log(
  "Keycloak realm ready: public OIDC client and 3 demo users verified.",
);
