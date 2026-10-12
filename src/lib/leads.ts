/**
 * leads.ts — lead-management helpers (Phase 5B & Super Admin).
 * Pure, DOM-free utilities: CSV building, source aggregation, status helpers.
 */

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export interface LeadCapture extends Record<string, unknown> {
  id?: string;
  name?: string;
  email: string;
  phone?: string;
  source: string;
  marketplace?: string;
  storeUrl?: string;
  status?: LeadStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Escape a single CSV cell per RFC 4180. */
export function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Build a CSV document (with header row) from lead records, newest first. */
export function buildLeadsCsv(leads: LeadCapture[]): string {
  const header = ["Name", "Email", "Phone", "Marketplace", "Source", "Status", "Created At", "Store URL", "Notes", "ID"];
  const rows = [...leads]
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .map(lead =>
      [
        lead.name ?? "",
        lead.email,
        lead.phone ?? "",
        lead.marketplace ?? "",
        lead.source,
        lead.status ?? "new",
        lead.createdAt,
        lead.storeUrl ?? "",
        lead.notes ?? "",
        lead.id ?? "",
      ].map(csvEscape).join(",")
    );
  return [header.join(","), ...rows].join("\r\n");
}

/** Format a raw timestamp as a readable local string (empty-safe). */
export function formatLeadDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/** Count leads per capture source, sorted by count desc. */
export function countBySource(leads: LeadCapture[]): { source: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.source || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export const LEAD_CSV_FILENAME = "dealxstocks-leads.csv";