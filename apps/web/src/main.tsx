import { StrictMode } from "react";
import { MotionConfig } from "motion/react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { auth } from "./auth";
import { ConnectionScreen } from "./ui";

const root = createRoot(document.getElementById("root")!);
root.render(<ConnectionScreen />);
try {
  await auth.init({
    onLoad: "check-sso",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });
  root.render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </StrictMode>,
  );
} catch {
  root.render(<ConnectionScreen failed />);
}
