import React from "react";
import { MessageSquare, Headset } from "lucide-react";

export function EmptyConversation({ title = "Select a conversation", message = "Choose a chat from the sidebar to view support history or respond to user queries." }: { title?: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#f0f2f5] dark:bg-gray-950/50">
      <div className="w-16 h-16 rounded-2xl bg-[#008069]/10 border border-[#008069]/30 flex items-center justify-center mb-4 text-[#008069]">
        <Headset className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-gray-200 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-gray-400 font-medium max-w-sm">{message}</p>
    </div>
  );
}
