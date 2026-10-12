import { useState, useRef } from "react";
import { ShieldOff, Send, Mail, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSuspensionGuard } from "../hooks/useSuspensionGuard";
import { SUSPENSION_APPEAL_SUBJECT } from "../data/adminData";
import { createTicket } from "../hooks/useApi";

export function SuspensionOverlay() {
  const { user, logout } = useAuth();
  const isSuspended = useSuspensionGuard();
  const [dismissed, setDismissed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isSuspended || dismissed) return null;

  function handleToggleForm() {
    setShowForm(v => !v);
    if (!showForm) setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      await createTicket({
        id: `tkt-${Date.now()}`,
        userId: user?.id ?? "unknown",
        userName: user?.name ?? "Unknown",
        userEmail: user?.email ?? "",
        subject: SUSPENSION_APPEAL_SUBJECT,
        message: message.trim(),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "open",
      });
    } catch {}
    setSending(false);
    setSent(true);
    setMessage("");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-red-600 to-rose-700 px-6 py-7 text-center relative">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldOff className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-extrabold text-xl">Account Suspended</p>
          <p className="text-white/80 text-sm mt-1.5">
            Your account has been suspended. Please contact support.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm text-center leading-relaxed">
            Task activity has been paused. Please contact support to appeal or
            resolve the issue.
          </p>

          {showForm && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide">Reach Support</p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://t.me/customerservice_160"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Telegram
                </a>
                <a
                  href="mailto:support@dealstocks.com"
                  className="flex items-center justify-center gap-1.5 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              </div>
              {sent ? (
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2.5">
                  <svg className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-600 dark:text-green-400 text-xs">Message sent. We'll review your appeal shortly.</p>
                </div>
              ) : (
                <>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Describe your situation or reason for appeal…"
                    rows={3}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
                  >
                    {sending ? "Sending…" : "Send Message"}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={handleToggleForm}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
            >
              <Send className="w-4 h-4" />
              {showForm ? "Hide Support Form" : "Send a Message"}
            </button>
          </div>

          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
