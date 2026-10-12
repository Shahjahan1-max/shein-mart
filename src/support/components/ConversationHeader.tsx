import React from "react";
import { User, ArrowLeft, MoreVertical, Shield } from "lucide-react";
import type { SupportConversation } from "../types";
import { OnlineIndicator } from "./OnlineIndicator";

interface ConversationHeaderProps {
  conversation: SupportConversation | null;
  onBack?: () => void;
  isStaff?: boolean;
}

export function ConversationHeader({ conversation, onBack, isStaff }: ConversationHeaderProps) {
  const displayName = conversation?.userName ?? "DealX Live Support";
  const displaySub = conversation?.userEmail ?? "Official Support Representative • Realtime Active";
  const isClosed = conversation?.status === "closed";

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-xs">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-[#008069] border border-emerald-600/30 flex items-center justify-center text-white font-bold uppercase shadow-sm">
            {conversation ? displayName.charAt(0) : <Shield className="w-5 h-5" />}
          </div>
          <OnlineIndicator lastActiveAt={conversation?.lastMessageAt} className="absolute -bottom-0.5 -right-0.5 border-2 border-white" />
        </div>

        <div>
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            {displayName}
            {isStaff && conversation?.userId && (
              <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                {conversation.userId.slice(0, 8)}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500">
            {displaySub}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isClosed ? (
          <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
            Closed
          </span>
        ) : (
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Support
          </span>
        )}
      </div>
    </div>
  );
}
