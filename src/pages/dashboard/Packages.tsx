import { useState } from "react";
import { useLocation } from "wouter";
import { RefreshCw, Lock, Unlock, ChevronRight, Zap } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { PACKAGES, SERIES, isKillMode } from "../../data/packagesData";
import { usePackagesCatalog } from "../../hooks/useCatalogs";
import { useLang } from "../../contexts/LangContext";

type SeriesFilter = "all" | "300" | "400" | "500" | "600" | "700";

const TABS: { label: string; value: SeriesFilter }[] = [
  { label: "All",      value: "all" },
  { label: "301–304",  value: "300" },
  { label: "401–404",  value: "400" },
  { label: "501–504",  value: "500" },
  { label: "601–604",  value: "600" },
  { label: "701–704",  value: "700" },
];

const SERIES_GRADIENT: Record<string, string> = {
  "300": "from-gray-400 to-gray-500",
  "400": "from-blue-400 to-blue-600",
  "500": "from-yellow-400 to-yellow-600",
  "600": "from-purple-500 to-purple-700",
  "700": "from-red-500 to-red-700",
};

export function Packages() {
  const [filter, setFilter] = useState<SeriesFilter>("all");
  const [, navigate] = useLocation();
  const { t } = useLang();
  const { data: packageCatalog } = usePackagesCatalog();
  const packages = packageCatalog.packages?.length ? packageCatalog.packages : PACKAGES;

  const visible = filter === "all"
    ? packages.filter(p => p.status === "active")
    : packages.filter(p => p.status === "active" && SERIES[filter]?.includes(p.code));

  return (
    <DashboardLayout showBack title={t("packages")} backTo="/dashboard/menu">
      <div className="max-w-4xl mx-auto space-y-4 p-4 md:p-6">
        {/* Tier Filter Tabs */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-2 shadow-sm">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  filter === tab.value
                    ? "bg-[#8A4FFF] text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Package Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map(pkg => {
            const seriesKey = String(Math.floor(pkg.code / 100) * 100);
            const gradClass = SERIES_GRADIENT[seriesKey] ?? "from-gray-400 to-gray-500";
            const killPkg = isKillMode(pkg);

            return (
              <button
                key={pkg.code}
                onClick={() => navigate(`/dashboard/packages/${pkg.code}`)}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden text-left hover:shadow-md active:scale-95 transition-all"
              >
                {/* Tier Banner */}
                <div className={`bg-gradient-to-r ${gradClass} px-3 py-2 flex items-center justify-between`}>
                  <span className="text-white font-extrabold text-lg leading-none">#{pkg.code}</span>
                  {killPkg
                    ? <RefreshCw className="w-4 h-4 text-white/90" />
                    : pkg.isFree
                      ? <Unlock className="w-4 h-4 text-white/90" />
                      : <Lock className="w-4 h-4 text-white/90" />
                  }
                </div>

                {/* Body */}
                <div className="p-3 space-y-2">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-tight line-clamp-2">{pkg.title}</p>

                  <div className="flex flex-wrap gap-1">
                    {killPkg && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" />∞
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-gray-400">{t("tasksLabel")}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{killPkg ? "∞" : pkg.taskCount}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-gray-400">{t("depositLabel")}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {pkg.isFree ? t("freeLabel") : `${pkg.deposit} USDT`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-gray-400">{t("rewardLabel")}</span>
                      <span className="font-semibold text-green-600">+{pkg.baseReward} USDT</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end text-[#8A4FFF] mt-1">
                    <span className="text-xs font-semibold">{t("openLabel")}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-gray-400">
            <p className="text-sm">{t("noPackagesInGroup")}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

