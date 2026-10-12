import { useState } from "react";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { useLang, LangCode } from "../contexts/LangContext";
import { useTheme } from "./ThemeToggle";
import { LanguageFlag } from "./LanguageFlag";
import { LanguageMenu } from "./LanguageMenu";

export function LangDropdown() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <LanguageFlag code={lang} />
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <LanguageMenu
            selected={lang}
            onSelect={code => { setLang(code as LangCode); setOpen(false); }}
            className="absolute right-0 top-full z-50 mt-1.5"
          />
        </>
      )}
    </div>
  );
}

export function ThemeBtn() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
