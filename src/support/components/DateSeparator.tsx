import React from "react";

export function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-3">
      <div className="bg-white border border-slate-200 rounded-full px-3 py-1 text-[11px] text-slate-600 font-semibold tracking-wide uppercase shadow-xs">
        {date}
      </div>
    </div>
  );
}
