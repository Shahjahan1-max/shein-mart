/**
 * RoiCalculator — interactive earnings estimator (Phase 4B).
 * Adjust traffic, conversion, commission and horizon to see projected
 * monthly and total commission income. Pure logic in data/roiCalculator.
 */

import { useState } from "react";
import { TrendingUp, MousePointerClick, Wallet, CalendarRange } from "lucide-react";
import {
  calculateRoi,
  formatNumber,
  formatUsd,
  ROI_DEFAULT_INPUT,
  type RoiInput,
} from "../data/roiCalculator";

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function SliderField({ label, value, min, max, step, suffix, onChange }: SliderFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</label>
        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
          {formatNumber(value)}
          {suffix && <span className="text-xs font-medium text-gray-400">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-purple-600"
        aria-label={label}
      />
    </div>
  );
}

export function RoiCalculator() {
  const [input, setInput] = useState<RoiInput>(ROI_DEFAULT_INPUT);
  const set = (patch: Partial<RoiInput>) => setInput(prev => ({ ...prev, ...patch }));
  const result = calculateRoi(input);

  const stats = [
    {
      icon: MousePointerClick,
      label: "Estimated orders / month",
      value: formatNumber(result.monthlyOrders),
    },
    {
      icon: TrendingUp,
      label: "Monthly revenue via links",
      value: formatUsd(result.monthlyRevenue),
    },
    {
      icon: Wallet,
      label: "Monthly commission",
      value: formatUsd(result.monthlyCommission),
    },
    {
      icon: CalendarRange,
      label: `Total commission (${input.months} months)`,
      value: formatUsd(result.totalCommission),
    },
  ];

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-5 p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60">
        <SliderField label="Monthly visits to deal links" value={input.monthlyVisits} min={0} max={10000} step={100} onChange={v => set({ monthlyVisits: v })} />
        <SliderField label="Conversion rate" value={input.conversionRate} min={0} max={20} step={0.5} suffix="%" onChange={v => set({ conversionRate: v })} />
        <SliderField label="Commission rate" value={input.commissionRate} min={0} max={20} step={0.5} suffix="%" onChange={v => set({ commissionRate: v })} />
        <SliderField label="Average order value (USD)" value={input.averageOrderValue} min={0} max={1000} step={5} onChange={v => set({ averageOrderValue: v })} />
        <SliderField label="Planning horizon" value={input.months} min={1} max={36} step={1} suffix=" months" onChange={v => set({ months: v })} />
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
          Estimates are illustrative and assume official marketplace affiliate or referral commission structures.
          Actual earnings vary by marketplace, category and buyer behaviour.
        </p>
      </div>

      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-purple-600/10 dark:bg-purple-500/20 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
