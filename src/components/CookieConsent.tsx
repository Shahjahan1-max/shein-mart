/**
 * CookieConsent — GDPR/privacy banner. Shows only while no explicit consent
 * decision exists, then persists it via `ds-analytics-consent` (which the
 * analytics lib reads). Accessible: role=region, clear labelled buttons.
 */

import { useState } from "react";
import { Cookie } from "lucide-react";
import {
  getConsentState,
  setAnalyticsConsent,
  trackEvent,
} from "../lib/analytics";

export function CookieConsent() {
  const [visible, setVisible] = useState(() => getConsentState() === "unset");

  if (!visible) return null;

  const decide = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setVisible(false);
    trackEvent("consent_decision", { decision: granted ? "accepted" : "declined" });
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-4 inset-x-4 z-[9998] sm:inset-x-auto sm:right-6 sm:left-auto sm:max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Cookie className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Your privacy matters</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
            We use cookies and analytics to understand how visitors use our site and to keep it
            reliable. Functional storage (theme, session) works either way — this choice only
            controls analytics tracking. See our{" "}
            <a
              href="/cookie-policy"
              className="font-semibold text-purple-600 dark:text-purple-400 hover:underline"
            >
              Cookie Policy
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => decide(true)}
              className="inline-flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 transition-colors"
            >
              Accept analytics
            </button>
            <button
              type="button"
              onClick={() => decide(false)}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Decline only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}