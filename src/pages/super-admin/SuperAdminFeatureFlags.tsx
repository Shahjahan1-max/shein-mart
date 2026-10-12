import { useState, useEffect } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, Toggle, StatusBadge, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { SEED_FEATURE_FLAGS } from "../../data/superAdminData";
import { useFirebaseDoc, saveGenericFirebaseDoc } from "../../hooks/useApi";
import { Flag, Rocket, Plus, Check, Loader2 } from "lucide-react";
import type { FeatureFlag } from "../../types/super-admin";

const ENV_TONE: Record<string, "green" | "amber" | "blue" | "gray"> = {
  production: "green", staging: "amber", development: "blue", all: "gray",
};

const FALLBACK_FLAGS_DOC = { id: "config", flags: SEED_FEATURE_FLAGS };

export default function SuperAdminFeatureFlags() {
  const { data: remoteDoc, loading, refetch } = useFirebaseDoc<{ id: string; flags?: FeatureFlag[] }>("featureFlags", "config", FALLBACK_FLAGS_DOC);
  const [flags, setFlags] = useState<FeatureFlag[]>(SEED_FEATURE_FLAGS);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (remoteDoc?.flags && Array.isArray(remoteDoc.flags) && remoteDoc.flags.length > 0) {
      setFlags(remoteDoc.flags);
    }
  }, [remoteDoc]);

  async function persistFlags(updatedFlags: FeatureFlag[]) {
    setFlags(updatedFlags);
    setIsSaving(true);
    try {
      await saveGenericFirebaseDoc("featureFlags", "config", { id: "config", flags: updatedFlags, updatedAt: new Date().toISOString() });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save feature flags to Firestore:", err);
    } finally {
      setIsSaving(false);
    }
  }

  function toggle(id: string, enabled: boolean) {
    const updated = flags.map(f => (f.id === id ? { ...f, enabled } : f));
    void persistFlags(updated);
  }

  function setRollout(id: string, percentage: number) {
    const updated = flags.map(f => (f.id === id ? { ...f, rolloutPercentage: percentage, enabled: percentage > 0 } : f));
    void persistFlags(updated);
  }

  const enabledCount = flags.filter(f => f.enabled).length;

  return (
    <SuperAdminLayout title="Feature Flags">
      <PageHeader
        title="Feature Flags & Release Management"
        description="Control feature rollout per environment with percentage-based canary releases synced live with Firestore."
        icon={<Flag className="w-5 h-5" />}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={`${enabledCount}/${flags.length} enabled`} tone="purple" />
            {isSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
            {savedSuccess && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Synced</span>}
          </div>
        }
      />

      <SectionCard title="Feature Flags" description="Toggle features and adjust rollout percentages (Changes persist live to Firebase)" icon={<Rocket className="w-4 h-4" />}>
        <div className="space-y-4">
          {flags.map(flag => (
            <div key={flag.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{flag.name}</p>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">{flag.id}</span>
                  <StatusBadge status={flag.environment} tone={ENV_TONE[flag.environment] ?? "gray"} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{flag.description}</p>
                {flag.targetRoles && flag.targetRoles.length > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">Targets: {flag.targetRoles.join(", ")}</p>
                )}
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <PermissionGate permission="feature_flags.edit">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-gray-400">Rollout</span>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={flag.rolloutPercentage}
                      onChange={e => setRollout(flag.id, Number(e.target.value))}
                      className="w-28 accent-purple-600"
                    />
                    <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums w-8">{flag.rolloutPercentage}%</span>
                  </div>
                </PermissionGate>
                <PermissionGate permission="feature_flags.edit">
                  <Toggle checked={flag.enabled} onChange={v => toggle(flag.id, v)} label={`Toggle ${flag.name}`} />
                </PermissionGate>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </SuperAdminLayout>
  );
}
