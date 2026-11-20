import Keycloak from "keycloak-js";

export const auth = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8080",
  realm: "tessera",
  clientId: "tessera-web",
});

export async function accessToken(): Promise<string> {
  await auth.updateToken(30);
  if (!auth.token) throw new Error("Увійдіть, щоб продовжити");
  return auth.token;
}
