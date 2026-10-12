import type { LangCode } from "../contexts/LangContext";

export const LANGUAGE_FLAG_SRC: Record<string, string> = {
  en: "/flags/en.svg",
  ar: "/flags/ar.svg",
  fr: "/flags/fr.svg",
  it: "/flags/it.svg",
  es: "/flags/es.svg",
  de: "/flags/de.svg",
  pt: "/flags/pt.svg",
  tr: "/flags/tr.svg",
  hi: "/flags/hi.svg",
  ja: "/flags/ja.svg",
  ko: "/flags/ko.svg",
  zh: "/flags/zh.svg",
  ru: "/flags/ru.svg",
  id: "/flags/id.svg",
  fa: "/flags/fa.svg",
  ur: "/flags/ur.svg",
};

export function LanguageFlag({ code, className = "" }: { code: LangCode | string; className?: string }) {
  const src = LANGUAGE_FLAG_SRC[String(code).toLowerCase()] ?? LANGUAGE_FLAG_SRC.en;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`h-3.5 w-5 rounded-[3px] object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/10 ${className}`}
    />
  );
}
