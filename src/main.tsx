import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportError } from "./lib/analytics";

function loadAnalytics() {
  void import("./lib/firebaseClient")
    .then(({ initFirebaseAnalytics }) => initFirebaseAnalytics())
    .catch(() => null);
}

/** Global runtime-error capture — feeds the analytics error funnel. */
function wireGlobalErrorReporting() {
  window.addEventListener("error", event => {
    reportError("window.onerror", event.error ?? event.message, {
      resource: event.filename ? `${event.filename}:${event.lineno}` : undefined,
    });
  });
  window.addEventListener("unhandledrejection", event => {
    reportError("unhandledrejection", event.reason ?? "Unhandled promise rejection");
  });
}

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(loadAnalytics, { timeout: 3000 });
} else {
  globalThis.setTimeout(loadAnalytics, 0);
}

wireGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);