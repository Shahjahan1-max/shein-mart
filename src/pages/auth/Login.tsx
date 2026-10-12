import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Wrench, UserPlus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAdmin } from "../../contexts/AdminContext";
import { useMaintenanceMode } from "../../hooks/useMaintenanceMode";
import logoImg from "@assets/Deal_Stocks_Icon.webp";

export function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, login } = useAuth();
  const { isAdmin, admin } = useAdmin();
  const isMaintenanceOn = useMaintenanceMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect if ALREADY logged in as user (prevents double login requirement)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error ?? "Login failed.");
    }
  };

  const noAccountError = error.toLowerCase().includes("no account") ||
                         error.toLowerCase().includes("not found") ||
                         error.toLowerCase().includes("register");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="flex items-center px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mr-2">
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
        <span className="text-base font-semibold text-gray-900 dark:text-white flex-1 text-center pr-7">Sign In</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <img src={logoImg} alt="DealX Stocks" className="h-16 w-16 object-contain mb-3" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your DealX Stocks account</p>
          </div>

          {isMaintenanceOn && (
            <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 mb-4">
              <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Platform Under Maintenance</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  You can still sign in. Dashboard access will resume once maintenance ends.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                <p>{error}</p>
                {noAccountError && (
                  <p className="mt-2">
                    New here?{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="font-semibold underline text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 transition-colors"
                    >
                      Create a free account →
                    </button>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-xl transition-colors shadow-sm disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              New to DealX Stocks?
            </p>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="w-full py-2.5 px-4 rounded-xl border border-purple-200 dark:border-purple-800/60 hover:border-purple-500 dark:hover:border-purple-400 text-purple-700 dark:text-purple-300 font-semibold text-sm bg-purple-50/70 hover:bg-purple-100/70 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
            >
              <UserPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Create a Free Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
