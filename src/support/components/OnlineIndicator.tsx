import React from "react";

interface OnlineIndicatorProps {
  lastActiveAt?: string;
  className?: string;
}

export function OnlineIndicator({ lastActiveAt, className = "" }: OnlineIndicatorProps) {
  // Simple check: active within last 5 minutes = online
  const isOnline = lastActiveAt
    ? Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000
    : false;

  if (!isOnline) return null;

  return (
    <span
      className={`w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-gray-900 ${className}`}
      title="Online"
    />
  );
}
