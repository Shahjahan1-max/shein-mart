/**
 * AdminLeads — /admin/leads & /super-admin/leads
 * Full Enterprise Lead-Capture & Prospecting Management Console.
 * Lists leads from Playbook downloads, Marketplace Audit quote requests,
 * and direct Admin creations. Supports real-time updates, status lifecycle,
 * CSV export, manual lead creation, and lead inspection.
 */

import { useState } from "react";
import {
  Users,
  Download,
  Search,
  Mail,
  Inbox,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  Globe,
  Tag,
  ExternalLink,
  ChevronDown,
  Loader2,
  Filter,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { useFirebaseCollection } from "../../hooks/useApi";
import { addFirebaseDoc, saveFirebaseDoc, deleteFirebaseDoc } from "../../lib/apiClient";
import {
  buildLeadsCsv,
  formatLeadDate,
  LEAD_CSV_FILENAME,
  type LeadCapture,
  type LeadStatus,
} from "../../lib/leads";

const STATUS_CONFIG: Record<LeadStatus, { label: string; bg: string; text: string; border: string }> = {
  new: {
    label: "New",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  contacted: {
    label: "Contacted",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
  qualified: {
    label: "Qualified",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
  },
  converted: {
    label: "Converted",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  lost: {
    label: "Lost",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
  },
};

const SAMPLE_LEADS: LeadCapture[] = [
  {
    name: "Marcus Vance",
    email: "marcus.vance@apexretail.io",
    phone: "+1 (555) 382-9102",
    source: "marketplace-audit-quote",
    marketplace: "Amazon",
    storeUrl: "https://amazon.com/shops/apex-retail-global",
    status: "new",
    notes: "High-volume Amazon FBA seller looking to optimize PPC spend and listing keywords.",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    name: "Elena Rostova",
    email: "elena@vanguardgoods.de",
    phone: "+49 30 901820",
    source: "deal-hunters-playbook",
    marketplace: "Alibaba",
    storeUrl: "https://vanguardgoods.de",
    status: "contacted",
    notes: "Downloaded playbook; wholesale buyer sourcing factory equipment.",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    name: "Tariq Mansoor",
    email: "tariq@gulfdropship.ae",
    phone: "+971 50 123 4567",
    source: "direct-outreach",
    marketplace: "AliExpress",
    storeUrl: "https://gulfdropship.ae",
    status: "qualified",
    notes: "Cross-border dropshipping distributor requiring priority support tier.",
    createdAt: new Date(Date.now() - 3600000 * 42).toISOString(),
  },
];

export default function AdminLeads({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { data: leads = [], loading, refetch } = useFirebaseCollection<LeadCapture>("leadCaptures");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inspectLead, setInspectLead] = useState<LeadCapture | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSource, setFormSource] = useState("direct-inquiry");
  const [formMarketplace, setFormMarketplace] = useState("Amazon");
  const [formStatus, setFormStatus] = useState<LeadStatus>("new");
  const [formStoreUrl, setFormStoreUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = leads.filter(l => {
    const matchesQuery = !q ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.name ?? "").toLowerCase().includes(q) ||
      (l.source ?? "").toLowerCase().includes(q) ||
      (l.marketplace ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || (l.status ?? "new") === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const totalCount = leads.length;
  const newCount = leads.filter(l => (l.status ?? "new") === "new").length;
  const contactedCount = leads.filter(l => l.status === "contacted" || l.status === "qualified").length;
  const convertedCount = leads.filter(l => l.status === "converted").length;

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function exportCsv() {
    const csv = buildLeadsCsv(leads);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = LEAD_CSV_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${leads.length} leads to CSV.`);
  }

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = formEmail.trim().toLowerCase();
    if (!cleanEmail) {
      showToast("Email address is required.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const docId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newLead: LeadCapture = {
        id: docId,
        name: formName.trim() || undefined,
        email: cleanEmail,
        phone: formPhone.trim() || undefined,
        source: formSource,
        marketplace: formMarketplace,
        status: formStatus,
        storeUrl: formStoreUrl.trim() || undefined,
        notes: formNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      await addFirebaseDoc("leadCaptures", newLead);
      showToast("Lead created successfully!");
      setCreateModalOpen(false);

      // Reset form
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      setFormStoreUrl("");
      setFormNotes("");
      setFormStatus("new");

      refetch();
    } catch (err) {
      console.error("Failed to create lead:", err);
      showToast("Failed to create lead.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(lead: LeadCapture, nextStatus: LeadStatus) {
    if (!lead.id) return;
    try {
      const updated: LeadCapture = {
        ...lead,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      await saveFirebaseDoc("leadCaptures", lead.id, updated);
      showToast(`Updated lead status to ${STATUS_CONFIG[nextStatus].label}`);
      refetch();
      if (inspectLead && inspectLead.id === lead.id) {
        setInspectLead(updated);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      showToast("Failed to update status.", "error");
    }
  }

  async function handleDeleteLead(id?: string) {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this lead?")) return;
    try {
      await deleteFirebaseDoc("leadCaptures", id);
      showToast("Lead removed.");
      if (inspectLead && inspectLead.id === id) setInspectLead(null);
      refetch();
    } catch (err) {
      console.error("Failed to delete lead:", err);
      showToast("Failed to delete lead.", "error");
    }
  }

  async function seedDemoLeads() {
    setSeeding(true);
    try {
      for (const sample of SAMPLE_LEADS) {
        await addFirebaseDoc("leadCaptures", sample);
      }
      showToast("Sample leads seeded successfully!");
      refetch();
    } catch (err) {
      console.error("Failed to seed demo leads:", err);
      showToast("Failed to seed sample leads.", "error");
    } finally {
      setSeeding(false);
    }
  }

  const content = (
    <div className="space-y-4">
      {toast && (
        <div
          className={`border text-sm px-4 py-3 rounded-xl flex items-center justify-between ${
            toast.type === "error"
              ? "bg-red-900/30 border-red-700/50 text-red-300"
              : "bg-emerald-900/30 border-emerald-700/50 text-emerald-300"
          }`}
        >
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-600/15 flex items-center justify-center">
              <Inbox className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Leads</p>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{totalCount}</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">New Leads</p>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{newCount}</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600/15 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">In Progress</p>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{contactedCount}</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-600/15 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Converted</p>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{convertedCount}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, email, phone, marketplace or source…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-200 outline-none focus:border-purple-400"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>

          {leads.length === 0 && (
            <button
              type="button"
              onClick={seedDemoLeads}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-3 py-2.5 text-xs font-bold text-white transition-colors shadow-sm"
              title="Add 3 sample leads to test the console"
            >
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Seed Demo Leads
            </button>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={leads.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-50 px-3.5 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/20">
                <th className="px-4 py-3.5 font-semibold">Contact / Name</th>
                <th className="px-4 py-3.5 font-semibold">Source</th>
                <th className="px-4 py-3.5 font-semibold">Marketplace</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Captured At</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                    Loading leads in real time…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <Users className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-300 font-semibold mb-1">
                      {q || statusFilter !== "all" ? "No leads match your active filters." : "No leads captured yet."}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
                      Inquiries from the Marketplace Audit form on /contact and playbook downloads on /resources write here automatically.
                    </p>
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      + Create First Lead Manually
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map(lead => {
                  const statusKey = (lead.status ?? "new") as LeadStatus;
                  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.new;

                  return (
                    <tr
                      key={lead.id ?? lead.email}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {lead.name || "Anonymous Contact"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span>{lead.email}</span>
                          {lead.phone && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600">•</span>
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{lead.phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-block text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-md">
                          {lead.source || "inquiry"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {lead.marketplace || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="relative inline-block">
                          <select
                            value={statusKey}
                            onChange={e => handleStatusChange(lead, e.target.value as LeadStatus)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer appearance-none pr-6 focus:outline-none ${cfg.bg} ${cfg.text} ${cfg.border}`}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="converted">Converted</option>
                            <option value="lost">Lost</option>
                          </select>
                          <ChevronDown className={`w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${cfg.text}`} />
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        {formatLeadDate(lead.createdAt)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setInspectLead(lead)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Inspect Lead Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Lead Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Create / Log New Lead</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Target Marketplace</label>
                  <select
                    value={formMarketplace}
                    onChange={e => setFormMarketplace(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                  >
                    <option value="Amazon">Amazon</option>
                    <option value="Alibaba">Alibaba</option>
                    <option value="AliExpress">AliExpress</option>
                    <option value="eBay">eBay</option>
                    <option value="Multi-Marketplace">Multi-Marketplace</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Source</label>
                  <select
                    value={formSource}
                    onChange={e => setFormSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                  >
                    <option value="marketplace-audit-quote">Marketplace Audit Quote</option>
                    <option value="deal-hunters-playbook">Deal Hunter's Playbook</option>
                    <option value="direct-outreach">Direct Outreach / Call</option>
                    <option value="landing-page">Landing Page Form</option>
                    <option value="referral">Referral</option>
                    <option value="custom">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as LeadStatus)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Store / Website URL</label>
                <input
                  type="url"
                  value={formStoreUrl}
                  onChange={e => setFormStoreUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes / Requirements</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Any context, conversation summary, or product focus…"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Lead Modal */}
      {inspectLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {inspectLead.name || "Lead Details"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{inspectLead.email}</p>
              </div>
              <button
                onClick={() => setInspectLead(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Status</span>
                <div className="flex items-center gap-1.5">
                  {(["new", "contacted", "qualified", "converted", "lost"] as LeadStatus[]).map(st => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(inspectLead, st)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize transition-colors ${
                        (inspectLead.status ?? "new") === st
                          ? `${STATUS_CONFIG[st].bg} ${STATUS_CONFIG[st].text} ${STATUS_CONFIG[st].border}`
                          : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-400"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium text-gray-900 dark:text-white">{inspectLead.phone || "—"}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Marketplace</span>
                <span className="font-medium text-gray-900 dark:text-white">{inspectLead.marketplace || "—"}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Source</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">{inspectLead.source}</span>
              </div>

              {inspectLead.storeUrl && (
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800 items-center">
                  <span className="text-gray-500">Store / Site</span>
                  <a
                    href={inspectLead.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-purple-600 hover:underline flex items-center gap-1 max-w-[200px] truncate"
                  >
                    {inspectLead.storeUrl} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Captured At</span>
                <span className="text-gray-700 dark:text-gray-300 tabular-nums">{formatLeadDate(inspectLead.createdAt)}</span>
              </div>

              {inspectLead.notes && (
                <div className="pt-2">
                  <span className="text-gray-500 block mb-1">Notes:</span>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {inspectLead.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => handleDeleteLead(inspectLead.id)}
                className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Lead
              </button>

              <a
                href={`mailto:${inspectLead.email}`}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" /> Send Email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isEmbedded) return content;
  return <AdminLayout title="Leads (Captures)">{content}</AdminLayout>;
}