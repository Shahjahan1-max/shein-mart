import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Lock, CheckCircle, XCircle, ArrowLeft, KeyRound } from "lucide-react";
import {
  verifyResetToken,
  consumeResetToken,
  expireStaleRequests,
} from "../../data/passwordResetData";
import type { PasswordResetRequest } from "../../data/passwordResetData";
import logoImg from "@assets/Deal_Stocks_Icon.webp";

type Stage = "loading" | "invalid" | "form" | "success";

function getTokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export function ResetPassword() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("loading");
  const [validReq, setValidReq] = useState<PasswordResetRequest | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rawToken = getTokenFromUrl();

  const verify = useCallback(async () => {
    setStage("loading");
    await expireStaleRequests();
    if (!rawToken) { setStage("invalid"); return; }
    const req = await verifyResetToken(rawToken);
    if (req) {
      setValidReq(req);
      setStage("form");
    } else {
      setStage("invalid");
    }
  }, [rawToken]);

  useEffect(() => { verify(); }, [verify]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const ok = await consumeResetToken(rawToken, password);
    setSubmitting(false);

    if (ok) {
      setStage("success");
    } else {
      setError("This reset link has expired or already been used. Please request a new one.");
      setStage("invalid");
    }
  }

  const expiresLabel = validReq
    ? new Date(validReq.expiresAt).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";

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
          </div>

          {stage === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Verifying reset link…</p>
            </div>
          )}

          {stage === "invalid" && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-700/40 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Link Invalid or Expired</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {error || "This reset link has expired, already been used, or was revoked. Please request a new one."}
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                className="w-full py-3.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
              >
                Request a New Link
              </button>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {stage === "form" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Set a new password</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  For <span className="font-medium text-gray-700 dark:text-gray-300">{validReq?.email}</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Link expires <span className="font-semibold">{expiresLabel}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-red-500 dark:text-red-400">Passwords do not match.</p>
                )}
                {password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-red-500 dark:text-red-400">Password must be at least 6 characters.</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || password.length < 6 || password !== confirm}
                  className="w-full py-3.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
                >
                  {submitting ? "Saving…" : "Set New Password"}
                </button>
              </form>
            </div>
          )}

          {stage === "success" && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-900/20 border border-green-700/40 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Password Updated</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your password has been changed successfully. Sign in with your new password.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
