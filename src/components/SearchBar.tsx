import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}

export function SearchBar({ value, onChange, className = "", placeholder = "Search products, categories, marketplaces..." }: SearchBarProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3.5 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 transition-all"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
