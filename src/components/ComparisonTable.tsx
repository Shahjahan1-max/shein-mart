/**
 * ComparisonTable — renders a data table (comparison matrix) responsively.
 * Used on /marketplaces and /guides to compare marketplaces side by side.
 */

import type { ComparisonColumn, ComparisonRow } from "../data/comparisons";

interface ComparisonTableProps {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  caption?: string;
}

const COLUMN_ACCENT: Record<string, string> = {
  amazon: "#FF9900",
  alibaba: "#FF6A00",
  aliexpress: "#E62B31",
  ebay: "#0064D2",
};

export function ComparisonTable({ columns, rows, caption }: ComparisonTableProps) {
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <div className="relative responsive-table-container rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm">
      <table className="w-full text-left text-sm min-w-[600px] sm:min-w-[640px]">
        <caption className="sr-only">{caption ?? "Marketplace comparison"}</caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/90 sticky top-0 z-10">
            <th scope="col" className="px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-800 z-20">
              Feature
            </th>
            {columns.map(col => (
              <th
                key={col.id}
                scope="col"
                className="px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-gray-100"
                style={COLUMN_ACCENT[col.id] ? { color: COLUMN_ACCENT[col.id] } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.attribute} className={`border-b border-gray-100 dark:border-gray-700/60 last:border-0 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors ${i % 2 ? "bg-gray-50/50 dark:bg-gray-800/40" : ""}`}>
              <th scope="row" className={`px-4 py-3.5 align-top sticky left-0 z-10 ${i % 2 ? "bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-800"}`}>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{row.attribute}</span>
                {row.note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-normal">{row.note}</p>}
              </th>
              {columns.map(col => (
                <td key={col.id} className="px-4 py-3.5 text-gray-600 dark:text-gray-300 align-top">
                  {row.values[col.id] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
