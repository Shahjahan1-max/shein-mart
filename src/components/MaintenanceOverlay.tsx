import { Wrench } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useMaintenanceMode } from "../hooks/useMaintenanceMode";

export function MaintenanceOverlay() {
  const { logout } = useAuth();
  const isMaintenanceOn = useMaintenanceMode();

  if (!isMaintenanceOn) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-amber-600 to-orange-700 px-6 py-7 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-extrabold text-xl">Maintenance Active</p>
          <p className="text-white/80 text-sm mt-1.5">
            The platform is temporarily unavailable.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm text-center leading-relaxed">
            Our team is working to improve your experience. All your balances,
            tasks, and history are safe and will be fully accessible once
            maintenance is complete.
          </p>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3">
            <p className="text-amber-700 dark:text-amber-300 text-xs font-medium text-center">
              No data has been lost. Please check back shortly.
            </p>
          </div>

          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
