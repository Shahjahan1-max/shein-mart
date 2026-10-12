import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useSettings } from "../hooks/useApi";
import { PlatformSettings } from "../data/adminData";

export function FirebaseSuspensionBanner() {
  const { data: settings } = useSettings<PlatformSettings>();
  const [dismissed, setDismissed] = useState(false);

  // Show only when Super Admin has enabled the alert AND the user hasn't dismissed it
  if (!settings?.firebaseAlertEnabled || dismissed) return null;

  return (
    <aside
      aria-label="Cloud Services Notice"
      className="bg-amber-600 dark:bg-amber-700 text-white text-xs font-medium px-3.5 py-2 shadow-md relative z-[100] flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0 max-w-7xl mx-auto flex-1">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-200" />
        <p className="truncate sm:whitespace-normal leading-tight">
          <strong className="font-bold uppercase tracking-wider text-[11px] bg-amber-800/60 px-1.5 py-0.5 rounded mr-1.5">
            Cloud Service Alert
          </strong>
          Firebase Cloud Database &amp; Real-time synchronization is temporarily in restricted mode (Subscription Plan Expired). Real-time sync and live chat operations are on hold pending provider renewal.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 text-amber-200 hover:text-white rounded-md transition-colors flex-shrink-0"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
}

