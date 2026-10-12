import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft, CheckCircle2, XCircle, Gift, LogIn } from "lucide-react";
import { useAuth, RegisterData } from "../../contexts/AuthContext";
import logoImg from "@assets/Deal_Stocks_Icon.webp";

export function Register() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterData & { confirmPassword: string }>({
    name: "", email: "", password: "", confirmPassword: "", phone: "", referralCode: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });

  // Pre-fill referral code from invite link query parameters (e.g. ?code=123456 or ?ref=123456)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const inviteCode = searchParams.get("code") || searchParams.get("ref") || searchParams.get("referral");
      if (inviteCode) {
        setForm(f => ({ ...f, referralCode: inviteCode.trim() }));
      }
    } catch {}
  }, []);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const touch = (key: "password" | "confirmPassword") => () =>
    setTouched(t => ({ ...t, [key]: true }));

  const pwLengthOk = form.password.length >= 6;
  const pwMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const pwMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!pwLengthOk) {
      setError("Password must be at least 6 characters.");
      setTouched(t => ({ ...t, password: true }));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      setTouched(t => ({ ...t, confirmPassword: true }));
      return;
    }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error ?? "Registration failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="flex items-center px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button onClick={() => navigate("/login")} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mr-2">
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
        <span className="text-base font-semibold text-gray-900 dark:text-white flex-1 text-center pr-7">Create Account</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <img src={logoImg} alt="DealX Stocks" className="h-14 w-14 object-contain mb-3" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Join DealX Stocks</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your account to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
                <input type="text" value={form.name} onChange={set("name")} placeholder="Your full name" required autoComplete="name"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
                <input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  onBlur={touch("password")}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  required
                  className={`w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-800 border rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.password && !pwLengthOk
                      ? "border-red-400 dark:border-red-600 focus:ring-red-400"
                      : form.password.length > 0 && pwLengthOk
                        ? "border-green-400 dark:border-green-600 focus:ring-green-400"
                        : "border-gray-200 dark:border-gray-700 focus:ring-purple-500"
                  }`}
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {/* Inline length hint */}
              {form.password.length > 0 && (
                <p className={`flex items-center gap-1 mt-1.5 text-xs ${pwLengthOk ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {pwLengthOk
                    ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {pwLengthOk ? "Password length is good" : `${6 - form.password.length} more character${6 - form.password.length === 1 ? "" : "s"} needed`}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
                <input
                  type={showPw ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  onBlur={touch("confirmPassword")}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                  className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                    pwMismatch
                      ? "border-red-400 dark:border-red-600 focus:ring-red-400"
                      : pwMatch
                        ? "border-green-400 dark:border-green-600 focus:ring-green-400"
                        : "border-gray-200 dark:border-gray-700 focus:ring-purple-500"
                  }`}
                />
              </div>
              {/* Inline match hint */}
              {form.confirmPassword.length > 0 && (
                <p className={`flex items-center gap-1 mt-1.5 text-xs ${pwMatch ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {pwMatch
                    ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {pwMatch ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            {/* Referral / Invitation Code (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Referral Code</label>
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40">Optional</span>
              </div>
              <div className="relative">
                <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={form.referralCode}
                  onChange={set("referralCode")}
                  placeholder="Enter referral code (optional)"
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono tracking-wider transition-all"
                />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Have an invitation code from a friend? Enter it to link your team.
              </p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-xl transition-colors shadow-sm disabled:cursor-not-allowed">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Already have an account?
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 text-gray-700 dark:text-gray-200 font-semibold text-sm bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
            >
              <LogIn className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Sign In to Your Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
