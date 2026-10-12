import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Mail, KeyRound, Copy, Check, AlertCircle } from "lucide-react";
import {
  requestPasswordReset,
  expireStaleRequests,
} from "../../data/passwordResetData";
import logoImg from "@assets/Deal_Stocks_Icon.webp";

type Stage = "form" | "success";

export function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [resetLink, setResetLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("Please enter your email address."); return; }
    setLoading(true);

    try {
      await expireStaleRequests();

      await new Promise(r => setTimeout(r, 700));

      await requestPasswordReset(trimmed);

      setStage("success");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="flex items-center px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={() => navigate("/login")}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mr-2"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
        <span className="text-base font-semibold text-gray-900 dark:text-white flex-1 text-center pr-7">
          Reset Password
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <img src={logoImg} alt="DealX Stocks" className="h-16 w-16 object-contain mb-3" />
            {stage === "form" ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot your password?</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Enter your email and we'll send you a reset link.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Check your inbox</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Please contact support to receive a secure reset link.
                </p>
              </>
            )}
          </div>

          {stage === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-xl transition-colors shadow-sm disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Remembered it?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-purple-600 dark:text-purple-400 font-semibold hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {stage === "success" && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300">Request submitted</p>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 ml-7">
                  For your security, reset links are not displayed in the browser.
                </p>
              </div>

              {resetLink && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Demo mode — reset link</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                        In a live deployment this link would be emailed to you. Copy it and open it in your browser.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-lg p-3 flex items-center gap-2">
                    <p className="flex-1 text-xs text-gray-700 dark:text-gray-300 font-mono break-all leading-relaxed">
                      {resetLink}
                    </p>
                    <button
                      onClick={handleCopy}
                      className="flex-shrink-0 p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                      title="Copy link"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate("/login")}
                className="w-full py-3 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
              >
                Back to Sign In
              </button>

              <button
                onClick={() => { setStage("form"); setEmail(""); setResetLink(""); }}
                className="w-full py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Try a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
