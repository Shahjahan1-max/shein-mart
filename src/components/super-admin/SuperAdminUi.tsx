import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/* ─── PageHeader ────────────────────────────────────────────────── */

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}

export function PageHeader({ title, description, icon, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="w-11 h-11 rounded-xl bg-purple-600/15 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center flex-shrink-0 text-purple-700 dark:text-purple-400">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm font-medium text-slate-600 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 sm:ml-auto flex-shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ─── StatCard ──────────────────────────────────────────────────── */

export interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: "purple" | "blue" | "emerald" | "amber" | "rose" | "slate";
}

const STAT_COLORS: Record<NonNullable<StatCardProps["color"]>, { bg: string; text: string; ring: string }> = {
  purple: { bg: "bg-purple-100 dark:bg-purple-500/15", text: "text-purple-700 dark:text-purple-400", ring: "border-purple-300 dark:border-purple-800/60" },
  blue:   { bg: "bg-blue-100 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-400", ring: "border-blue-300 dark:border-blue-800/60" },
  emerald:{ bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", ring: "border-emerald-300 dark:border-emerald-800/60" },
  amber:  { bg: "bg-amber-100 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", ring: "border-amber-300 dark:border-amber-800/60" },
  rose:   { bg: "bg-rose-100 dark:bg-rose-500/15", text: "text-rose-700 dark:text-rose-400", ring: "border-rose-300 dark:border-rose-800/60" },
  slate:  { bg: "bg-slate-100 dark:bg-slate-500/15", text: "text-slate-700 dark:text-slate-400", ring: "border-slate-300 dark:border-slate-800/60" },
};

export function StatCard({ label, value, sub, icon, trend, trendLabel, color = "purple" }: StatCardProps) {
  const c = STAT_COLORS[color];
  return (
    <div className={cn("bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs transition-shadow")}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border", c.bg, c.text, c.ring)}>
          {icon}
        </div>
        {trend && trend !== "neutral" && (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold",
            trend === "up" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400"
            : trend === "down" ? "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-400"
            : "bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-400",
          )}>
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "•"} {trendLabel ?? trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">{value}</p>
      <p className="text-sm font-bold text-slate-700 dark:text-gray-300 mt-2">{label}</p>
      {sub && <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ─── SectionCard ───────────────────────────────────────────────── */

export interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function SectionCard({ title, description, icon, actions, children, className, padded = true }: SectionCardProps) {
  return (
    <section className={cn("bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-slate-500 dark:text-gray-400 flex-shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h2>
              {description && <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mt-0.5 truncate">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

/* ─── PermissionGate ────────────────────────────────────────────── */

import { useSuperAdmin } from "../../hooks/super-admin/useSuperAdmin";
import type { Permission } from "../../types/super-admin";

export function PermissionGate({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useSuperAdmin();
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

export function usePermission(permission: Permission): boolean {
  const { can } = useSuperAdmin();
  return can(permission);
}

/* ─── StatusBadge ───────────────────────────────────────────────── */

export type BadgeTone = "gray" | "green" | "amber" | "red" | "blue" | "purple" | "sky" | "orange";

const TONES: Record<BadgeTone, string> = {
  gray:   "bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 font-bold",
  green:  "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 font-bold",
  amber:  "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800 font-bold",
  red:    "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-800 font-bold",
  blue:   "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-800 font-bold",
  purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400 border-purple-300 dark:border-purple-800 font-bold",
  sky:    "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-400 border-sky-300 dark:border-sky-800 font-bold",
  orange: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-400 border-orange-300 dark:border-orange-800 font-bold",
};

export function StatusBadge({ status, tone }: { status: ReactNode; tone?: BadgeTone }) {
  const toneValue: BadgeTone = tone ?? "gray";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border", TONES[toneValue])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export function statusToneFor(value: string): BadgeTone {
  const v = value.toLowerCase();
  if (["active", "healthy", "approved", "completed", "complete", "published", "resolved", "enabled", "online"].includes(v)) return "green";
  if (["pending", "inactive", "processing", "maintenance", "scheduled", "draft"].includes(v)) return "amber";
  if (["rejected", "suspended", "disabled", "degraded", "cancelled", "error", "failed", "unhealthy"].includes(v)) return "red";
  if (["deleted", "archived"].includes(v)) return "gray";
  if (["verified", "mfa"].includes(v)) return "blue";
  return "gray";
}

/* ─── EmptyState ────────────────────────────────────────────────── */

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">{icon}</div>}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Toggle ────────────────────────────────────────────────────── */

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        checked ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}
