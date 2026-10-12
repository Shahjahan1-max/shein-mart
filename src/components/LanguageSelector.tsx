import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useLang } from "../contexts/LangContext";
import { LanguageFlag } from "./LanguageFlag";
import { LanguageMenu } from "./LanguageMenu";

export function LanguageSelector() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Globe className="h-4 w-4" />
        <LanguageFlag code={lang} />
        <span className="hidden sm:inline font-medium">{lang.toUpperCase()}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <LanguageMenu
          selected={lang}
          onSelect={code => { setLang(code); setOpen(false); }}
          className="absolute right-0 top-full z-50 mt-2"
        />
      )}
    </div>
  );
}
