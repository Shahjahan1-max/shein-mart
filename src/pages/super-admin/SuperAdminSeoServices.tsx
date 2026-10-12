import { useState, useEffect } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatCard, StatusBadge, statusToneFor, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { SEED_SEO_SERVICES } from "../../data/superAdminData";
import { useFirebaseDoc, saveGenericFirebaseDoc } from "../../hooks/useApi";
import { Search, Plus, Users, BarChart3, Check, Loader2 } from "lucide-react";

export interface SeoServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  marketplace: string[];
  features: string[];
  status: string;
  pricing: {
    model: string;
    basePrice: number;
  };
}

const FALLBACK_SEO_DOC = { id: "config", services: SEED_SEO_SERVICES as SeoServiceItem[] };

export default function SuperAdminSeoServices() {
  const { data: remoteDoc } = useFirebaseDoc<{ id: string; services?: SeoServiceItem[] }>("seoServices", "config", FALLBACK_SEO_DOC);
  const [rows, setRows] = useState<SeoServiceItem[]>(SEED_SEO_SERVICES as SeoServiceItem[]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (remoteDoc?.services && Array.isArray(remoteDoc.services) && remoteDoc.services.length > 0) {
      setRows(remoteDoc.services);
    }
  }, [remoteDoc]);

  async function toggleStatus(id: string) {
    const updated = rows.map(s => (s.id === id ? { ...s, status: s.status === "active" ? "draft" : "active" } as SeoServiceItem : s));
    setRows(updated);
    setIsSaving(true);
    try {
      await saveGenericFirebaseDoc("seoServices", "config", { id: "config", services: updated, updatedAt: new Date().toISOString() });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save SEO services to Firestore:", err);
    } finally {
      setIsSaving(false);
    }
  }

  const activeCount = rows.filter(s => s.status === "active").length;
  const monthlyRevenue = rows
    .filter(s => s.status === "active")
    .reduce((sum, s) => sum + (s.pricing.model === "monthly" ? s.pricing.basePrice : 0), 0);

  return (
    <SuperAdminLayout title="SEO Services">
      <PageHeader
        title="SEO Service Catalog"
        description="Manage the international SEO & growth service offerings, pricing, and approval status synced with Firestore."
        icon={<Search className="w-5 h-5" />}
        badge={
          <div className="flex items-center gap-2">
            {isSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
            {savedSuccess && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Synced</span>}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Services" value={rows.length} icon={<Search className="w-5 h-5" />} color="purple" />
        <StatCard label="Active" value={activeCount} icon={<BarChart3 className="w-5 h-5" />} color="emerald" />
        <StatCard label="MRR (Active)" value={`$${monthlyRevenue.toLocaleString()}`} icon={<Users className="w-5 h-5" />} color="amber" />
      </div>

      <div className="space-y-4">
        {rows.map(svc => (
          <SectionCard key={svc.id}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{svc.name}</h3>
                  <StatusBadge status={svc.status} tone={statusToneFor(svc.status)} />
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 capitalize">{svc.category.replace("_", " ")}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{svc.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {svc.marketplace.map((mp: string) => (
                    <span key={mp} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 capitalize">{mp}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {svc.features.slice(0, 3).map((f: string) => (
                    <span key={f} className="px-2 py-0.5 rounded-md text-[10px] bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800">{f}</span>
                  ))}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 flex-shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">${svc.pricing.basePrice.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-600 dark:text-gray-400 capitalize">{svc.pricing.model === "monthly" ? "/month" : "per project"}</p>
                </div>
                <PermissionGate permission="seo_services.edit">
                  <button className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">Manage</button>
                </PermissionGate>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </SuperAdminLayout>
  );
}
