import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { auth } from "./auth";

const root = createRoot(document.getElementById("root")!);
try {
  await auth.init({
    onLoad: "check-sso",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });
} catch {
  root.render(
    <main className="auth-error">
      Не вдалося з’єднатися з Keycloak. Перевірте, чи запущений контейнер.
    </main>,
  );
}
if (auth.didInitialize)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
