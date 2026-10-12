import React from "react";

export function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#008069] font-medium italic animate-pulse">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#008069] animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#008069] animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#008069] animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span>{names.join(", ")} {names.length === 1 ? "is" : "are"} typing...</span>
    </div>
  );
}
