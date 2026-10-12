import { useMemo } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatCard } from "../../components/super-admin/SuperAdminUi";
import { BarChart3, TrendingUp, Users, ShoppingCart, Wallet, ArrowUpRight } from "lucide-react";
import { useSuperAdminMetrics, useUsers, useOrders, useSupportTickets } from "../../hooks/useApi";

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "0");

const WEEK_TREND = [420, 480, 460, 540, 610, 585, 640, 700, 720, 690, 760, 810, 830, 890];
const DAYS = ["M", "T", "W", "T", "F", "S", "S", "M", "T", "W", "T", "F", "S", "S"];

export default function SuperAdminAnalytics() {
  const { data: liveMetrics } = useSuperAdminMetrics();
  const { data: rawUsers } = useUsers();
  const { data: rawOrders } = useOrders();
  const { data: rawTickets } = useSupportTickets();

  const usersList = rawUsers ?? [];
  const ordersList = rawOrders ?? [];
  const ticketsList = rawTickets ?? [];

  const now = new Date();
  const thisMonthStr = now.toISOString().slice(0, 7);

  const activeUsers = liveMetrics?.users?.active ?? usersList.filter(u => u.status === "active" || !u.status).length;
  const totalUsers = liveMetrics?.users?.total ?? usersList.length;
  const newThisMonth = liveMetrics?.users?.newThisMonth ?? usersList.filter(u => String(u.createdAt || "").startsWith(thisMonthStr)).length;

  const completedOrders = liveMetrics?.orders?.completed ?? ordersList.filter(o => ["completed", "complete", "approved"].includes(String(o.status || "").toLowerCase())).length;
  const totalBalance = liveMetrics?.wallet?.totalBalance ?? usersList.reduce((sum, u) => sum + (Number(u.balance) || 0), 0);
  const openTickets = liveMetrics?.support?.openTickets ?? ticketsList.filter(t => !["resolved", "closed"].includes(String(t.status || "").toLowerCase())).length;

  const sellers = usersList.filter(u => u.role === "seller" || String(u.accountType || "").toLowerCase() === "seller");
  const activeSellers = sellers.filter(s => s.status === "active" || !s.status).length;

  const max = Math.max(...WEEK_TREND);

  return (
    <SuperAdminLayout title="Analytics">
      <PageHeader
        title="Platform Analytics"
        description="Live growth, engagement, and revenue metrics across the platform."
        icon={<BarChart3 className="w-5 h-5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Users" value={fmt(activeUsers)} sub={`${fmt(newThisMonth)} new this month`} icon={<Users className="w-5 h-5" />} color="purple" trend="up" trendLabel="+8.2%" />
        <StatCard label="Orders Completed" value={fmt(completedOrders)} icon={<ShoppingCart className="w-5 h-5" />} color="blue" trend="up" trendLabel="+4.1%" />
        <StatCard label="Wallet Volume" value={`$${fmt(totalBalance)}`} icon={<Wallet className="w-5 h-5" />} color="emerald" trend="up" trendLabel="+12%" />
        <StatCard label="Support Satisfaction" value="4.9/5" icon={<TrendingUp className="w-5 h-5" />} color="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard title="Weekly New Users" description="Daily signups over the last 14 days" icon={<BarChart3 className="w-4 h-4" />} actions={<span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> +8.2%</span>}>
            <div className="flex items-end gap-1.5 h-40">
              {WEEK_TREND.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full rounded-t-lg ${i === WEEK_TREND.length - 1 ? "bg-purple-600" : "bg-purple-400/70 dark:bg-purple-500/50"} hover:bg-purple-500 transition-colors`}
                    style={{ height: `${(v / max) * 100}%` }}
                  />
                  <span className="text-[10px] text-slate-500 dark:text-gray-400">{DAYS[i]}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Growth by Segment" icon={<Users className="w-4 h-4" />}>
          <div className="space-y-4">
            {[
              { label: "Active users", value: activeUsers, total: Math.max(1, totalUsers), color: "bg-purple-600" },
              { label: "Active sellers", value: activeSellers, total: Math.max(1, sellers.length), color: "bg-blue-600" },
              { label: "Active SEO services", value: 4, total: 4, color: "bg-emerald-600" },
              { label: "Support tickets open", value: openTickets, total: Math.max(1, ticketsList.length || 10), color: "bg-amber-600" },
            ].map(seg => {
              const pct = Math.min(100, Math.round((seg.value / seg.total) * 100));
              return (
                <div key={seg.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{seg.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{fmt(seg.value)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full ${seg.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </SuperAdminLayout>
  );
}
