import amazonLogo from "@assets/Amazon_Logo_1776687129282.webp";
import alibabaLogo from "@assets/AliBaba_Logo_1776687129281.jfif";
import aliExpressLogo from "@assets/Ali_Express_Logo_1776687129279.webp";
import { DEFAULT_SETTINGS } from "../data/adminData";
import { useSettings } from "../hooks/useApi";

interface PlatformLogoProps {
  logo: "amazon" | "alibaba" | "aliexpress";
  size?: "sm" | "md" | "lg";
}

const SIZE = { sm: "w-12 h-12", md: "w-16 h-16", lg: "w-20 h-20" };

const DEFAULT_LOGOS: Record<string, string> = {
  amazon: amazonLogo,
  alibaba: alibabaLogo,
  aliexpress: aliExpressLogo,
};

export function PlatformLogo({ logo, size = "md" }: PlatformLogoProps) {
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS & { platformLogos?: Record<string, string> }>();
  const customLogos = (apiSettings as { platformLogos?: Record<string, string> } | null)?.platformLogos ?? {};
  const base = `${SIZE[size]} rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center bg-white shadow-sm border border-gray-100`;
  const src = customLogos[logo] ?? DEFAULT_LOGOS[logo];

  if (src) {
    return (
      <div className={base}>
        <img src={src} alt={logo} className="w-full h-full object-contain p-2" />
      </div>
    );
  }

  return (
    <div className={`${SIZE[size]} rounded-xl flex-shrink-0 bg-orange-500 flex items-center justify-center`}>
      <span className="text-white font-extrabold text-sm">{logo[0].toUpperCase()}</span>
    </div>
  );
}
