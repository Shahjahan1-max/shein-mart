import React, { useState, useEffect } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { MapPin, Search, RefreshCw, Trash2, ExternalLink, ShieldCheck, Monitor, Smartphone, Globe, AlertCircle } from "lucide-react";
import { api, deleteFirebaseDoc } from "../../lib/apiClient";

export interface VisitorLocationDoc {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  ip: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  userAgent?: string;
  platform?: string;
  screen?: string;
  language?: string;
  pagePath?: string;
  acceptedAt?: string;
  createdAt?: string;
}

export default function SuperAdminVisitorLocations() {
  const [logs, setLogs] = useState<VisitorLocationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: VisitorLocationDoc[] }>("/api/super-admin/visitor-locations", { requiresAdmin: true });
      if (res?.data) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error("Failed to load visitor locations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    const onDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ collection?: string }>).detail;
      if (!detail?.collection || detail.collection === "visitorLocations") {
        fetchLocations();
      }
    };
    window.addEventListener("ds:data-changed", onDataChanged);
    return () => window.removeEventListener("ds:data-changed", onDataChanged);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this location log entry?")) return;
    try {
      await api.delete(`/api/super-admin/visitor-locations/${encodeURIComponent(id)}`, { requiresAdmin: true });
      setLogs(prev => prev.filter(item => item.id !== id));
      showToast("Location log deleted.");
    } catch {
      showToast("Failed to delete entry.");
    }
  };

  const filteredLogs = logs.filter(log => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (log.ip || "").toLowerCase().includes(q) ||
      (log.userId || "").toLowerCase().includes(q) ||
      (log.userName || "").toLowerCase().includes(q) ||
      (log.userEmail || "").toLowerCase().includes(q) ||
      (log.pagePath || "").toLowerCase().includes(q) ||
      (log.userAgent || "").toLowerCase().includes(q)
    );
  });

  return (
    <SuperAdminLayout title="Visitor & User Device Tracking">
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                Device Location & Real IP Tracker
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time security governance logging exact device IP addresses, browser specifications, and GPS coordinates of visitors and users.
              </p>
            </div>
          </div>

          <button
            onClick={fetchLocations}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 text-gray-700 dark:text-gray-200 text-xs font-extrabold transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Real IP, User ID, Email, Path..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-primary"
            />
          </div>
          <span className="text-xs text-muted-foreground font-semibold flex-shrink-0">
            Total Logs: <strong className="text-gray-900 dark:text-white">{filteredLogs.length}</strong>
          </span>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-xs text-muted-foreground font-semibold">Loading real-time location logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center">
              <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-3 opacity-60" />
              <p className="text-sm font-bold text-gray-800 dark:text-white">No location logs recorded yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Logs will automatically appear when visitors or users accept location access.</p>
            </div>
          ) : (
            <div className="responsive-table-container">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-gray-800/60 border-b border-slate-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider font-bold">
                    <th className="px-4 py-3.5">User / Visitor</th>
                    <th className="px-4 py-3.5">Real Device IP</th>
                    <th className="px-4 py-3.5">GPS Coordinates</th>
                    <th className="px-4 py-3.5">Device & Screen</th>
                    <th className="px-4 py-3.5">Path / Page</th>
                    <th className="px-4 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {filteredLogs.map(log => {
                    const hasGeo = log.latitude != null && log.longitude != null;
                    const mapsUrl = hasGeo ? `https://www.google.com/maps?q=${log.latitude},${log.longitude}` : null;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        {/* User / Visitor */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {log.userName || "Guest Visitor"}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {log.userEmail || log.userId}
                          </div>
                        </td>

                        {/* Real IP */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-gray-800 font-mono font-extrabold text-primary text-xs border border-slate-200 dark:border-gray-700">
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            {log.ip}
                          </span>
                        </td>

                        {/* GPS Coordinates */}
                        <td className="px-4 py-3">
                          {hasGeo ? (
                            <a
                              href={mapsUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{log.latitude?.toFixed(4)}, {log.longitude?.toFixed(4)}</span>
                              <ExternalLink className="w-3 h-3 ml-0.5" />
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">IP Geo Only</span>
                          )}
                        </td>

                        {/* Device & Screen */}
                        <td className="px-4 py-3 max-w-xs truncate">
                          <div className="text-gray-800 dark:text-gray-200 font-medium truncate" title={log.userAgent}>
                            {log.platform || "Device"} · {log.screen || "Screen"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate" title={log.userAgent}>
                            {log.userAgent}
                          </div>
                        </td>

                        {/* Page Path */}
                        <td className="px-4 py-3 font-mono text-purple-600 dark:text-purple-400 font-semibold">
                          {log.pagePath}
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
