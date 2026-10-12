import React from "react";
import { Check, CheckCheck, Clock, AlertCircle, Trash2 } from "lucide-react";
import type { SupportMessage } from "../types";

interface MessageBubbleProps {
  message: SupportMessage;
  isSelf: boolean;
  onImageClick?: (url: string) => void;
  onDelete?: (message: SupportMessage) => void;
}

export function MessageBubble({ message, isSelf, onImageClick, onDelete }: MessageBubbleProps) {
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isStaffSender = message.senderRole === "admin" || message.senderRole === "super_admin";

  return (
    <div className={`flex flex-col ${isSelf ? "items-end" : "items-start"} my-1 px-1 group`}>
      <div
        className={`relative max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-xs text-sm break-words transition-all ${
          isSelf
            ? "bg-[#d9fdd3] text-slate-900 border border-[#b4f0aa] rounded-tr-xs"
            : isStaffSender
            ? "bg-[#e8f4ff] text-slate-900 border border-blue-100 rounded-tl-xs shadow-xs"
            : "bg-white text-slate-900 border border-slate-200/80 rounded-tl-xs shadow-xs"
        }`}
      >
        {onDelete && (
          <button
            onClick={() => onDelete(message)}
            className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700"
            title="Super Admin: Delete/Moderate Message"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        {message.type === "image" && message.imageUrl ? (
          <div className="mb-1 rounded-lg overflow-hidden cursor-pointer max-w-xs" onClick={() => onImageClick?.(message.imageUrl!)}>
            <img
              src={message.imageUrl}
              alt="Support Attachment"
              className="w-full h-auto object-cover max-h-60 rounded-lg hover:opacity-95 transition-opacity"
              loading="lazy"
            />
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-wrap select-text">{message.text}</p>
        )}

        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] tabular-nums ${isSelf ? "text-slate-500 font-medium" : "text-slate-400"}`}>
          <span>{formattedTime}</span>
          {isSelf && (
            <span>
              {message.status === "sending" ? (
                <Clock className="w-3 h-3 animate-spin opacity-70" />
              ) : message.status === "failed" ? (
                <AlertCircle className="w-3 h-3 text-red-500" />
              ) : message.status === "read" && isStaffSender ? (
                <span title="Read by user"><CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /></span>
              ) : (
                <span title="Sent"><Check className="w-3.5 h-3.5 text-slate-400" /></span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
