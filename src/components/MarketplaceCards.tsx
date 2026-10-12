import { ExternalLink, TrendingUp, Package, Zap, Globe } from "lucide-react";
import { useLandingPageSettings } from "../hooks/useLandingPageSettings";
import { useLang } from "../contexts/LangContext";
import { translateDisplayText } from "../data/displayTranslations";

const CARD_STYLES = [
  {
    gradient: "from-orange-400 to-yellow-400",
    bg: "from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20",
    border: "border-orange-200 dark:border-orange-800",
    icon: TrendingUp,
    color: "#FF9900",
  },
  {
    gradient: "from-orange-500 to-red-400",
    bg: "from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20",
    border: "border-orange-200 dark:border-orange-800",
    icon: Package,
    color: "#FF6A00",
  },
  {
    gradient: "from-red-500 to-rose-400",
    bg: "from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20",
    border: "border-red-200 dark:border-red-800",
    icon: Zap,
    color: "#E62B31",
  },
  {
    gradient: "from-blue-500 to-indigo-400",
    bg: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: Globe,
    color: "#3B82F6",
  },
];

export function MarketplaceCards() {
  const { data: cfg } = useLandingPageSettings();
  const { lang } = useLang();

  const activeCards = cfg.marketplaceCards.filter(c => c.active);
  if (activeCards.length === 0) return null;

  return (
    <section className="py-10 sm:py-12 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
          {translateDisplayText(cfg.marketplaceSection.title, lang)}
        </h2>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">{translateDisplayText(cfg.marketplaceSection.subtitle, lang)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {activeCards.map((mp, idx) => {
          const style = CARD_STYLES[idx % CARD_STYLES.length];
          const Icon = style.icon;
          return (
            <a
              key={mp.id}
              href={mp.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative bg-gradient-to-br ${style.bg} border ${style.border} rounded-2xl p-5 sm:p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden min-w-0`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

              <div className="flex items-start justify-between gap-3 mb-4">
                <div className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${style.gradient} shadow-lg flex-shrink-0`}>
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                {mp.badge && (
                  <div className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-300 min-w-0 break-words">
                    {translateDisplayText(mp.badge, lang)}
                  </div>
                )}
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1 leading-tight break-words">{translateDisplayText(mp.name, lang)}</h3>
              {mp.tagline && <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{translateDisplayText(mp.tagline, lang)}</p>}

              <div className="flex flex-wrap items-center justify-between gap-2">
                {mp.stats && <span className="text-sm font-semibold min-w-0 break-words" style={{ color: style.color }}>{translateDisplayText(mp.stats, lang)}</span>}
                <div className={`flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg bg-gradient-to-r ${style.gradient} group-hover:shadow-md transition-shadow ml-auto flex-shrink-0`}>
                  {translateDisplayText("Shop now", lang)} <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
