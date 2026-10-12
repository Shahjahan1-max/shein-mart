import { useState, useEffect } from "react";
import { ShieldCheck, Cookie, CheckCircle2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { recordUserConsent, CONSENT_STORAGE_KEY, type ConsentPreferences } from "../lib/telemetryCollector";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/apiClient";

export function UnifiedConsentBanner() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [grantedFeedback, setGrantedFeedback] = useState(false);

  // Preference switches
  const [prefAnalytics, setPrefAnalytics] = useState(true);
  const [prefFraud, setPrefFraud] = useState(true);
  const [prefMarketing, setPrefMarketing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!saved) {
        setIsOpen(true);
        return;
      }
      const parsed: ConsentPreferences = JSON.parse(saved);
      if (!parsed.expiresAt || Date.now() > Date.parse(parsed.expiresAt)) {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;

  async function handleAcceptAll() {
    setIsSubmitting(true);
    const prefs: ConsentPreferences = {
      necessary: true,
      security: true,
      analytics: true,
      fraud_prevention: true,
      marketing: true,
    };

    await recordUserConsent(prefs, user?.id, "accepted_all");

    // Seamlessly capture device location for visitor tracker if supported
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await api.post("/api/visitor-location", {
              userId: user?.id || "guest",
              userName: user?.name || "Guest Visitor",
              userEmail: user?.email || "",
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              screen: `${window.screen.width}x${window.screen.height}`,
              language: navigator.language,
              pagePath: window.location.pathname,
            });
          } catch {}
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }

    setGrantedFeedback(true);
    setTimeout(() => {
      setIsOpen(false);
    }, 1200);
  }

  async function handleSaveCustom() {
    setIsSubmitting(true);
    const prefs: ConsentPreferences = {
      necessary: true,
      security: true,
      analytics: prefAnalytics,
      fraud_prevention: prefFraud,
      marketing: prefMarketing,
    };

    await recordUserConsent(prefs, user?.id, "custom_preferences");
    setGrantedFeedback(true);
    setTimeout(() => {
      setIsOpen(false);
    }, 1200);
  }

  async function handleRejectOptional() {
    setIsSubmitting(true);
    const prefs: ConsentPreferences = {
      necessary: true,
      security: true,
      analytics: false,
      fraud_prevention: false,
      marketing: false,
    };

    await recordUserConsent(prefs, user?.id, "rejected_optional");
    setGrantedFeedback(true);
    setTimeout(() => {
      setIsOpen(false);
    }, 1200);
  }

  return (
    <div
      role="region"
      aria-label="Privacy & Security Consent"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] max-w-sm sm:max-w-md w-full p-2 pointer-events-auto animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="relative bg-white/95 dark:bg-gray-900/95 border border-slate-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4 text-left border-l-4 border-l-purple-600 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-purple-600/20 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                Privacy, Security & Cookies
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">
                DealX Stocks Integrity Standard · Valid for 90 Days
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
          We use cookies and telemetry signals to secure your account, prevent unauthorized multi-account duplicate abuse, verify regional IPs, and ensure seamless trading.
        </p>

        {/* Feature Badges */}
        <div className="space-y-2 bg-slate-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-slate-100 dark:border-gray-800 text-[11px]">
          <div className="flex items-center gap-2 text-slate-800 dark:text-gray-200 font-semibold">
            <Cookie className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span>Essential session tokens & functional preferences</span>
          </div>
          <div className="flex items-center gap-2 text-slate-800 dark:text-gray-200 font-semibold">
            <Lock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span>Real-time fraud prevention & device authentication</span>
          </div>
        </div>

        {/* Expandable Preferences */}
        {showPreferences && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-gray-800 text-xs">
            <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-gray-800/40">
              <span className="font-semibold text-slate-700 dark:text-gray-300">Fraud Prevention & Security</span>
              <input
                type="checkbox"
                checked={prefFraud}
                onChange={e => setPrefFraud(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-gray-800/40">
              <span className="font-semibold text-slate-700 dark:text-gray-300">Performance & Analytics</span>
              <input
                type="checkbox"
                checked={prefAnalytics}
                onChange={e => setPrefAnalytics(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-gray-800/40">
              <span className="font-semibold text-slate-700 dark:text-gray-300">Marketing & Promotional</span>
              <input
                type="checkbox"
                checked={prefMarketing}
                onChange={e => setPrefMarketing(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </label>
          </div>
        )}

        {/* Expiry Note & Links */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <a href="/privacy-policy" className="hover:text-purple-600 dark:hover:text-purple-400 underline">Privacy Policy</a>
            <span>·</span>
            <a href="/cookie-policy" className="hover:text-purple-600 dark:hover:text-purple-400 underline">Cookie Policy</a>
          </div>
          <button
            type="button"
            onClick={() => setShowPreferences(prev => !prev)}
            className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
          >
            <span>Preferences</span>
            {showPreferences ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Action Buttons */}
        {grantedFeedback ? (
          <div className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md animate-pulse">
            <CheckCircle2 className="w-4 h-4" />
            <span>Consent Saved & Telemetry Initialized!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {showPreferences ? (
              <button
                type="button"
                onClick={handleSaveCustom}
                disabled={isSubmitting}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>Save Selected Preferences</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAcceptAll}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-lg hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Accept All & Enable Real-Time Security</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleRejectOptional}
              disabled={isSubmitting}
              className="w-full py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
            >
              Essential & Security Baseline Only
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
