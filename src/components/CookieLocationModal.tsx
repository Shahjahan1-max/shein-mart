import React, { useState, useEffect } from "react";
import { ShieldCheck, MapPin, CheckCircle2, Cookie, X } from "lucide-react";
import { api } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";

const ACCEPTANCE_KEY = "ds_cookie_location_accepted";
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

export function CookieLocationModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    try {
      const savedTimeStr = localStorage.getItem(ACCEPTANCE_KEY);
      if (!savedTimeStr) {
        setIsOpen(true);
        return;
      }

      const savedTime = parseInt(savedTimeStr, 10);
      if (isNaN(savedTime) || Date.now() - savedTime > FIFTEEN_DAYS_MS) {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleAcceptAndAllow = () => {
    setIsSubmitting(true);

    const submitLocationData = async (lat?: number, lng?: number, accuracy?: number) => {
      try {
        await api.post("/api/visitor-location", {
          userId: user?.id || "guest",
          userName: user?.name || "Guest Visitor",
          userEmail: user?.email || "",
          latitude: lat ?? null,
          longitude: lng ?? null,
          accuracy: accuracy ?? null,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screen: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
          pagePath: window.location.pathname,
        });
      } catch (err) {
        console.warn("Location log payload warning:", err);
      } finally {
        try {
          localStorage.setItem(ACCEPTANCE_KEY, Date.now().toString());
        } catch {}
        setGranted(true);
        setTimeout(() => {
          setIsOpen(false);
        }, 1200);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          submitLocationData(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy
          );
        },
        (error) => {
          console.warn("Geolocation permission error/fallback:", error.message);
          submitLocationData();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      submitLocationData();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] max-w-sm sm:max-w-md w-full p-2 pointer-events-auto">
      <div className="relative bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] space-y-4 text-left border-l-4 border-l-primary transition-all duration-300 backdrop-blur-xl">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                Cookies & Location Consent
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium">
                DealX Stocks Security Standard
              </p>
            </div>
          </div>
        </div>

        {/* Short Description */}
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
          We use cookies & device location permissions to ensure account security, verify real IPs, and deliver regional marketplace deals.
        </p>

        {/* Feature Badges */}
        <div className="space-y-2 bg-slate-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-slate-100 dark:border-gray-800 text-[11px]">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-semibold">
            <Cookie className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span>Essential cookies & session tokens</span>
          </div>
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span>Device location & real IP verification</span>
          </div>
        </div>

        {/* Expiry Note */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>* Required once every 15 days</span>
          <span className="font-semibold text-primary">15-Day Policy</span>
        </div>

        {/* Action Button */}
        {granted ? (
          <div className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md animate-pulse">
            <CheckCircle2 className="w-4 h-4" />
            <span>Consent Saved & Recorded!</span>
          </div>
        ) : (
          <button
            onClick={handleAcceptAndAllow}
            disabled={isSubmitting}
            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-lg hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Accept & Allow Location</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
