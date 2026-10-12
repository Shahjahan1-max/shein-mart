/**
 * LeadMagnetForm — email capture for the free "Deal Hunter's Playbook".
 * Stores leads into the public `leadCaptures` Firebase collection via the
 * generic API (no auth required). Shows a success state after subscribing.
 */

import { useState } from "react";
import { Mail, CheckCircle2, Send, BookOpen } from "lucide-react";
import { addFirebaseDoc } from "../lib/apiClient";
import { trackEvent } from "../lib/analytics";

interface LeadCapture extends Record<string, unknown> {
  id?: string;
  email: string;
  source: string;
  createdAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LeadMagnetForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      await addFirebaseDoc<LeadCapture>("leadCaptures", {
        email: trimmed,
        source: "deal-hunters-playbook",
        createdAt: new Date().toISOString(),
      });
      setStatus("success");
      trackEvent("generate_lead", { source: "deal-hunters-playbook" });
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">You're on the list!</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          The Deal Hunter's Playbook is on its way. Meanwhile, start with our{" "}
          <a href="/guides" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
            free shopping guides
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Free: The Deal Hunter's Playbook</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            10 proven strategies to spot real discounts and never overpay on global marketplaces.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1 relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              setStatus("idle");
            }}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30"
            aria-label="Email address"
          />
        </label>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : "Send it to me"}
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      {status === "error" && (
        <p className="text-xs text-red-500 mt-2">Please enter a valid email address.</p>
      )}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
        No spam. Unsubscribe anytime. We only use your email to send the playbook and deal updates.
      </p>
    </div>
  );
}
