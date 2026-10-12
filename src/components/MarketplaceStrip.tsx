import amazonLogo from "@assets/Amazon_Logo_1776687129282.webp";
import alibabaLogo from "@assets/AliBaba_Logo_1776687129281.jfif";
import aliExpressLogo from "@assets/Ali_Express_Logo_1776687129279.webp";
import ebayLogo from "@assets/ebay-logo_1776687129277.jpg";
import { DEFAULT_SETTINGS } from "../data/adminData";
import { useSettings } from "../hooks/useApi";

interface BrandItem {
  id: "amazon" | "alibaba" | "aliexpress" | "ebay";
  name: string;
  logoSrc?: string;
  color: string;
  bg: string;
}

const ALL_BRANDS: BrandItem[] = [
  { id: "amazon",     name: "Amazon",     logoSrc: amazonLogo,     color: "#FF9900", bg: "#fff" },
  { id: "alibaba",    name: "Alibaba",    logoSrc: alibabaLogo,    color: "#FF6A00", bg: "#fff" },
  { id: "aliexpress", name: "AliExpress", logoSrc: aliExpressLogo, color: "#E62B31", bg: "#fff" },
  { id: "ebay",       name: "eBay",       logoSrc: ebayLogo,       color: "#E53238", bg: "#fff" },
];

function BrandLogo({ brand, customLogos }: { brand: BrandItem; customLogos: Record<string, string> }) {
  const custom = customLogos[brand.id] || null;
  const src = custom ?? brand.logoSrc;

  if (src) {
    return (
      <div
        className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md border border-gray-200/50"
        style={{ background: brand.bg }}
      >
        <img src={src} alt={brand.name} className="w-full h-full object-contain p-1.5" />
      </div>
    );
  }

  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
      style={{ background: brand.color }}
    >
      <span className="text-white font-extrabold text-xs">{brand.name[0]}</span>
    </div>
  );
}

export function MarketplaceStrip() {
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS & { platformLogos?: Record<string, string> }>();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const stripConfig = {
    visible: settings.brandStripVisible !== false,
    items: { ...DEFAULT_SETTINGS.brandStripItems, ...(settings.brandStripItems ?? {}) },
  };
  const customLogos = (settings as { platformLogos?: Record<string, string> }).platformLogos ?? {};

  if (!stripConfig.visible) return null;

  const activeBrands = ALL_BRANDS.filter(b => stripConfig.items[b.id] !== false);
  if (activeBrands.length === 0) return null;

  const STRIP = [...activeBrands, ...activeBrands, ...activeBrands, ...activeBrands];

  return (
    <div className="w-full bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 py-6 overflow-hidden border-y border-gray-800/50 relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-gray-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-gray-950 to-transparent z-10 pointer-events-none" />

      <div
        className="flex items-center whitespace-nowrap"
        style={{ animation: "marquee 35s linear infinite" }}
      >
        {STRIP.map((brand, i) => (
          <div key={`${brand.id}-${i}`} className="inline-flex items-center gap-3 mx-12 flex-shrink-0 group">
            <BrandLogo brand={brand} customLogos={customLogos} />
            <span className="text-white/80 group-hover:text-white font-semibold text-sm tracking-wide transition-colors">
              {brand.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
