import { useState, useEffect } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatCard, StatusBadge, statusToneFor, Toggle, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { SEED_MARKETPLACES } from "../../data/superAdminData";
import { useFirebaseDoc, saveGenericFirebaseDoc } from "../../hooks/useApi";
import { Globe, Plus, ExternalLink, Activity, Check, Loader2 } from "lucide-react";
import type { MarketplaceConfig } from "../../types/super-admin";

const FALLBACK_MP_DOC = { id: "config", marketplaces: SEED_MARKETPLACES };

export default function SuperAdminMarketplaces() {
  const { data: remoteDoc } = useFirebaseDoc<{ id: string; marketplaces?: MarketplaceConfig[] }>("marketplaceGovernance", "config", FALLBACK_MP_DOC);
  const [rows, setRows] = useState<MarketplaceConfig[]>(SEED_MARKETPLACES);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (remoteDoc?.marketplaces && Array.isArray(remoteDoc.marketplaces) && remoteDoc.marketplaces.length > 0) {
      setRows(remoteDoc.marketplaces);
    }
  }, [remoteDoc]);

  async function persistMarketplaces(updated: MarketplaceConfig[]) {
    setRows(updated);
    setIsSaving(true);
    try {
      await saveGenericFirebaseDoc("marketplaceGovernance", "config", { id: "config", marketplaces: updated, updatedAt: new Date().toISOString() });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save marketplace config:", err);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleEnabled(id: string, enabled: boolean) {
    const updated = rows.map(m => (m.id === id ? { ...m, enabled, status: enabled ? "active" : "maintenance" } as MarketplaceConfig : m));
    void persistMarketplaces(updated);
  }

  const activeCount = rows.filter(m => m.enabled).length;
  const maintenanceCount = rows.filter(m => m.status === "maintenance").length;

  return (
    <SuperAdminLayout title="Marketplace Management">
      <PageHeader
        title="Marketplace Management"
        description="Configure integrations, credentials status, and feature coverage per marketplace."
        icon={<Globe className="w-5 h-5" />}
        badge={
          <div className="flex items-center gap-2">
            {isSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
            {savedSuccess && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Synced</span>}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total" value={rows.length} icon={<Globe className="w-5 h-5" />} color="purple" />
        <StatCard label="Active" value={activeCount} icon={<Activity className="w-5 h-5" />} color="emerald" />
        <StatCard label="Maintenance" value={maintenanceCount} icon={<ExternalLink className="w-5 h-5" />} color="amber" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map(mp => (
          <SectionCard key={mp.id} padded={false}>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-900 dark:text-white font-extrabold text-sm flex-shrink-0"
                    style={{ backgroundColor: mp.color }}
                  >
                    {mp.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{mp.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{mp.code}</p>
                  </div>
                </div>
                <StatusBadge status={mp.status} tone={statusToneFor(mp.status)} />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{mp.description}</p>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-slate-500 dark:text-gray-400">Commission</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{mp.commissionRate}%</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-slate-500 dark:text-gray-400">Uptime</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{mp.sla.uptime}%</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-slate-500 dark:text-gray-400">Markets</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{mp.supportedCountries.length}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {Object.entries(mp.features).filter(([, v]) => v).map(([k]) => (
                  <span key={k} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {k.replace("_", " ")}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <Toggle checked={mp.enabled} onChange={v => toggleEnabled(mp.id, v)} label={`Enable ${mp.name}`} />
                  Enabled
                </label>
                <PermissionGate permission="marketplaces.configure">
                  <button className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">Configure</button>
                </PermissionGate>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </SuperAdminLayout>
  );
}
