import { useState, useEffect, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAdmin } from "../../contexts/AdminContext";
import { ShieldCheck, Eye, EyeOff, Crown } from "lucide-react";
import { ThemeToggle } from "../../components/ThemeToggle";

interface AdminLoginProps {
  isSuperAdminPortal?: boolean;
}

export function AdminLogin({ isSuperAdminPortal }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { admin, isAdmin, login } = useAdmin();
  const [location, setLocation] = useLocation();

  const isSuperAdminRoute = Boolean(isSuperAdminPortal || location.startsWith("/super-admin"));

  // Auto-redirect if ALREADY logged in with matching role privileges
  useEffect(() => {
    if (isAdmin && admin) {
      const role = String(admin.role || "").toLowerCase();
      const isSuper = role === "super_admin" || role === "superadmin" || role === "owner";
      if (isSuperAdminRoute) {
        if (isSuper) {
          setLocation("/super-admin");
        }
        // When on /super-admin/login, if currently a regular admin, do NOT bounce to /admin.
        // Allow the user to authenticate into their Super Admin account.
      } else {
        if (isSuper) {
          setLocation("/super-admin");
        } else {
          setLocation("/admin");
        }
      }
    }
  }, [isAdmin, admin, isSuperAdminRoute, setLocation]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await login(username, password);
      if (res.success && res.admin) {
        const role = String(res.admin.role || "").toLowerCase();
        const isSuper = role === "super_admin" || role === "superadmin" || role === "owner";

        if (isSuperAdminRoute) {
          if (isSuper) {
            setLocation("/super-admin");
          } else {
            setError("This account is a standard Admin account and does not have Super Admin governance privileges. Please sign in at /admin/login or use a Super Admin credential.");
            setLoading(false);
          }
        } else {
          if (isSuper) {
            setLocation("/super-admin");
          } else {
            setLocation("/admin");
          }
        }
      } else {
        setError(res.error || "Login failed. Please check your credentials.");
        setLoading(false);
      }
    } catch {
      setError("Login failed. Please check your connection and credentials.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 relative transition-colors duration-300">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg ${isSuperAdminRoute ? "bg-amber-600 shadow-amber-900/20" : "bg-primary shadow-primary/20"}`}>
            {isSuperAdminRoute ? <Crown className="w-8 h-8 text-white" /> : <ShieldCheck className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isSuperAdminRoute ? "Super Admin Governance" : "Admin Panel"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {isSuperAdminRoute ? "DealX Stocks — Master Control Access" : "DealX Stocks — Restricted Access"}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email or username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  data-lpignore="true"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                  required
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-semibold py-3 rounded-xl transition-colors text-white shadow-md ${
                isSuperAdminRoute
                  ? "bg-amber-600 hover:bg-amber-700 disabled:opacity-60"
                  : "bg-primary hover:bg-primary/90 disabled:opacity-60"
              }`}
            >
              {loading ? "Signing in…" : isSuperAdminRoute ? "Sign In to Super Admin" : "Sign In to Admin"}
            </button>
          </form>

          <p className="text-center text-gray-500 dark:text-gray-400 text-xs mt-6">
            This portal is restricted to authorized personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
