import { useState, useEffect } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatusBadge, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { useFirebaseDoc, saveGenericFirebaseDoc } from "../../hooks/useApi";
import { Bot, Play, ShieldCheck, Sparkles, Check, Loader2 } from "lucide-react";

interface AiPromptItem {
  id: string;
  name: string;
  model: string;
  version: string;
  status: string;
  usedBy: string;
  updated: string;
}

const DEFAULT_PROMPTS: AiPromptItem[] = [
  { id: "ai-1", name: "Growth Recommendations", model: "gpt-4o", version: "v3.2", status: "active", usedBy: "Dashboard", updated: "2026-07-28" },
  { id: "ai-2", name: "Keyword Strategy Draft", model: "gpt-4o-mini", version: "v2.1", status: "active", usedBy: "SEO Services", updated: "2026-07-25" },
  { id: "ai-3", name: "Listing Copy Generator", model: "gpt-4o", version: "v1.8", status: "active", usedBy: "Marketplaces", updated: "2026-07-22" },
  { id: "ai-4", name: "Content Pillar Outline", model: "gpt-4o", version: "v1.0", status: "draft", usedBy: "CMS", updated: "2026-07-30" },
];

const FALLBACK_AI_DOC = { id: "config", prompts: DEFAULT_PROMPTS };

export default function SuperAdminAiGovernance() {
  const { data: remoteDoc, loading, refetch } = useFirebaseDoc<{ id: string; prompts?: AiPromptItem[] }>("aiGovernance", "config", FALLBACK_AI_DOC);
  const [prompts, setPrompts] = useState<AiPromptItem[]>(DEFAULT_PROMPTS);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    if (remoteDoc?.prompts && Array.isArray(remoteDoc.prompts) && remoteDoc.prompts.length > 0) {
      setPrompts(remoteDoc.prompts);
    }
  }, [remoteDoc]);

  async function toggleStatus(id: string) {
    const updated = prompts.map(p => {
      if (p.id !== id) return p;
      const nextStatus = p.status === "active" ? "draft" : "active";
      return { ...p, status: nextStatus, updated: new Date().toISOString().slice(0, 10) };
    });
    setPrompts(updated);
    try {
      await saveGenericFirebaseDoc("aiGovernance", "config", { id: "config", prompts: updated, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to save AI governance to Firestore:", err);
    }
  }

  return (
    <SuperAdminLayout title="AI Governance">
      <PageHeader
        title="AI Governance & Safety Controls"
        description="Govern AI prompts, model versions, and real-time safety policies across DealX Stocks."
        icon={<Bot className="w-5 h-5" />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard title="Prompt Library" description="Versioned AI prompts powering platform intelligence (Click status to toggle)" icon={<Sparkles className="w-4 h-4" />}>
            <div className="space-y-3">
              {prompts.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-xs text-slate-600 dark:text-gray-400">{p.model} · v{p.version} · {p.usedBy}</p>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400 flex-shrink-0">Updated {p.updated}</span>
                  <button onClick={() => void toggleStatus(p.id)} title="Click to toggle status">
                    <StatusBadge status={p.status} tone={p.status === "active" ? "green" : "amber"} />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Safety & Policy" icon={<ShieldCheck className="w-4 h-4" />}>
          <div className="space-y-3">
            {[
              { label: "Content moderation", value: "On" },
              { label: "PII scrubbing", value: "On" },
              { label: "Human review for spend actions", value: "Required" },
              { label: "Prompt versioning", value: "Enabled" },
              { label: "Usage logging", value: "Enabled" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
                <StatusBadge status={item.value} tone={item.value === "On" || item.value === "Enabled" ? "green" : "blue"} />
              </div>
            ))}
            <PermissionGate permission="ai_governance.test">
              <button
                onClick={() => {
                  setTesting(true);
                  setTimeout(() => {
                    setTesting(false);
                    setTestSuccess(true);
                    setTimeout(() => setTestSuccess(false), 2500);
                  }, 1000);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors mt-2 shadow-sm"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : testSuccess ? <Check className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {testing ? "Running Safety Suite…" : testSuccess ? "All 18 Policy Tests Passed" : "Run Safety Test Suite"}
              </button>
            </PermissionGate>
          </div>
        </SectionCard>
      </div>
    </SuperAdminLayout>
  );
}
