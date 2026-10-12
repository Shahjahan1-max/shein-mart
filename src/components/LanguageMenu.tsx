import { Check } from "lucide-react";
import { LANGUAGES, type LangCode } from "../contexts/LangContext";
import { LanguageFlag } from "./LanguageFlag";

interface LanguageMenuProps {
  selected: LangCode;
  onSelect: (code: LangCode) => void;
  className?: string;
}

export function LanguageMenu({ selected, onSelect, className = "" }: LanguageMenuProps) {
  return (
    <div
      className={`w-[min(17.5rem,calc(100vw-1rem))] max-h-[min(70vh,28rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-gray-200/90 dark:border-gray-700/90 bg-white/95 dark:bg-gray-800/95 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.75)] backdrop-blur [scrollbar-width:thin] [scrollbar-color:rgb(168_85_247)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-purple-400/70 ${className}`}
    >
      <div className="py-1.5">
        {LANGUAGES.map(option => {
          const active = selected === option.code;
          return (
            <button
              key={option.code}
              onClick={() => onSelect(option.code)}
              className={`w-full min-h-10 flex items-center gap-3 px-3.5 py-2.5 text-sm transition-all ${
                active
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/70"
              }`}
            >
              <LanguageFlag code={option.code} className="flex-shrink-0" />
              <span className="w-7 flex-shrink-0 text-xs font-bold text-gray-400">{option.code.toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-left font-semibold">{option.native}</span>
              {active && <Check className="h-3.5 w-3.5 flex-shrink-0 text-purple-600 dark:text-purple-300" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
