import React from "react";
import { Search, MessageSquare, Clock } from "lucide-react";
import type { SupportConversation } from "../types";
import { OnlineIndicator } from "./OnlineIndicator";

interface ConversationListProps {
  conversations: SupportConversation[];
  selectedId?: string;
  onSelect: (conv: SupportConversation) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  loading?: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-200 dark:border-gray-800 bg-[#f0f2f5] dark:bg-gray-900">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700/60 rounded-xl pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#008069]"
          />
        </div>
      </div>

      {/* Conversations Scroll */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800/40">
        {loading && conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-gray-500 font-medium">Loading chats...</div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-gray-500 font-medium">No conversations found.</div>
        ) : (
          conversations.map(conv => {
            if (!conv || !conv.id) return null;
            const displayName = String(conv.userName || conv.userId || "User").trim();
            const initial = (displayName.charAt(0) || "U").toUpperCase();
            const isSelected = conv.id === selectedId || conv.userId === selectedId;
            const unreadCount = Number(conv.unreadForStaff || 0);
            const hasUnread = unreadCount > 0;
            const timeStr = conv.lastMessageAt
              ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full text-left p-3 flex items-start gap-3 transition-colors ${
                  isSelected
                    ? "bg-[#f0f2f5] dark:bg-purple-950/40 border-l-4 border-[#008069]"
                    : "hover:bg-slate-50 dark:hover:bg-gray-800/60"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-[#008069] flex items-center justify-center font-bold text-white text-sm shadow-xs">
                    {initial}
                  </div>
                  <OnlineIndicator lastActiveAt={conv.lastMessageAt} className="absolute bottom-0 right-0 border-2 border-white dark:border-gray-900" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={`text-sm truncate ${hasUnread ? "text-slate-900 dark:text-white font-extrabold" : "text-slate-800 dark:text-gray-200 font-bold"}`}>
                      {displayName}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-gray-500 flex-shrink-0 tabular-nums font-medium">{timeStr}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${hasUnread ? "text-[#008069] dark:text-purple-300 font-bold" : "text-slate-600 dark:text-gray-400 font-medium"}`}>
                      {conv.lastMessage || "No messages yet"}
                    </p>

                    {hasUnread && (
                      <span className="flex-shrink-0 bg-[#25d366] text-slate-950 text-[10px] font-extrabold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center shadow-xs">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
