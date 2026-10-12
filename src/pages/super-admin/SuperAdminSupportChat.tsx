import { useState, useEffect, useRef } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { HeadphonesIcon, MessageSquare, ShieldCheck, Trash2 } from "lucide-react";
import { useAdmin } from "../../contexts/AdminContext";
import { api } from "../../lib/apiClient";
import { useSuperAdmin } from "../../hooks/super-admin/useSuperAdmin";
import { useSupportConversationList } from "../../support/hooks/useSupportConversationList";
import { useSupportConversation } from "../../support/hooks/useSupportConversation";
import { useTypingIndicator } from "../../support/hooks/useTypingIndicator";
import { ConversationList } from "../../support/components/ConversationList";
import { ConversationHeader } from "../../support/components/ConversationHeader";
import { MessageBubble } from "../../support/components/MessageBubble";
import { MessageComposer } from "../../support/components/MessageComposer";
import { DateSeparator } from "../../support/components/DateSeparator";
import { TypingIndicator } from "../../support/components/TypingIndicator";
import { ImagePreviewModal } from "../../support/components/ImagePreviewModal";
import { EmptyConversation } from "../../support/components/EmptyConversation";
import type { SupportConversation } from "../../support/types";

export default function SuperAdminSupportChat() {
  const { admin } = useAdmin();
  const { roleDefinition } = useSuperAdmin();
  const [selectedConv, setSelectedConv] = useState<SupportConversation | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const {
    conversations,
    loading: convsLoading,
    searchQuery,
    setSearchQuery,
    totalUnreadStaff,
  } = useSupportConversationList();

  const {
    conversation: activeConv,
    messages: chatMessages,
    loading: chatLoading,
    sending: chatSending,
    send: sendChatMessage,
    markRead: markChatRead,
  } = useSupportConversation({
    userId: selectedConv?.userId ?? "",
    userName: selectedConv?.userName ?? "User",
    senderId: admin?.id ?? "super-admin",
    senderName: admin?.username ? `${admin.username} (Super Admin)` : "Super Admin",
    senderRole: "super_admin",
  });

  const { typingUsers } = useTypingIndicator(
    selectedConv?.id,
    admin?.id ?? "super-admin",
    admin?.username ? `${admin.username} (Super Admin)` : "Super Admin",
    { disableSend: true }
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevChatCount = useRef(0);

  useEffect(() => {
    if (chatMessages.length !== prevChatCount.current) {
      prevChatCount.current = chatMessages.length;
      chatEndRef.current?.scrollIntoView({ behavior: chatMessages.length <= 1 ? "instant" : "smooth" });
    }
    if (selectedConv) markChatRead();
  }, [chatMessages.length, selectedConv, markChatRead]);

  // Group messages by date
  const groupedChatMessages: { date: string; msgs: typeof chatMessages }[] = [];
  chatMessages.forEach(msg => {
    const d = new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const lastGroup = groupedChatMessages[groupedChatMessages.length - 1];
    if (lastGroup && lastGroup.date === d) {
      lastGroup.msgs.push(msg);
    } else {
      groupedChatMessages.push({ date: d, msgs: [msg] });
    }
  });

  async function handleDeleteMessage(msg: { id: string }) {
    if (!selectedConv) return;
    if (!confirm("Delete this message permanently? This is real-time and irreversible.")) return;
    try {
      const { deleteRtdbMessage } = await import("../../support/services/supportRtdb");
      await deleteRtdbMessage(selectedConv.id, msg.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete message.");
    }
  }

  async function handleDeleteConversation() {
    if (!selectedConv) return;
    if (!confirm(`Delete ENTIRE conversation with ${selectedConv.userName}? All messages, typing data, and the conversation record will be permanently removed from Firebase RTDB.`)) return;
    try {
      const { deleteRtdbConversation } = await import("../../support/services/supportRtdb");
      await deleteRtdbConversation(selectedConv.id);
      setSelectedConv(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete conversation.");
    }
  }

  return (
    <SuperAdminLayout title="Support Workspace">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#008069]/10 border border-[#008069]/30 flex items-center justify-center text-[#008069]">
              <HeadphonesIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Super Admin Support Console
                {totalUnreadStaff > 0 && (
                  <span className="bg-[#008069] text-white text-xs px-2 py-0.5 rounded-full font-extrabold shadow-sm">
                    {totalUnreadStaff} Unread
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Governance & direct user live messaging center</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#008069]" />
              {roleDefinition?.name ?? "Super Admin"}
            </span>
          </div>
        </div>

        {/* Support Chat Workspace Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden h-[calc(100vh-210px)] min-h-[580px] max-h-[820px] shadow-lg">
          {/* Conversation List Sidebar — Always Persistent & Fixed */}
          <div className={`md:col-span-4 lg:col-span-4 h-full border-r border-slate-200 dark:border-gray-800 flex flex-col min-h-0 ${selectedConv ? "hidden md:block" : "block"}`}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConv?.id}
              onSelect={conv => setSelectedConv(conv)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={convsLoading}
            />
          </div>

          {/* Active Chat Area */}
          <div className={`md:col-span-8 lg:col-span-8 h-full flex flex-col min-h-0 ${!selectedConv ? "hidden md:flex" : "flex"}`}>
            {selectedConv ? (
              <>
                <ConversationHeader
                  conversation={selectedConv}
                  onBack={() => setSelectedConv(null)}
                  isStaff
                />
                {/* Super Admin: Delete Entire Conversation */}
                <div className="flex items-center justify-end gap-2 px-3 py-1.5 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800">
                  <button
                    onClick={handleDeleteConversation}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Entire Conversation
                  </button>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-1 bg-[#efeae2] dark:bg-gray-950 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:16px_16px]">
                  {chatLoading && chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-600 dark:text-gray-400 font-medium">
                      Loading conversation...
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-600 dark:text-gray-400 font-medium">
                      No messages yet in this conversation.
                    </div>
                  ) : (
                    groupedChatMessages.map(group => (
                      <div key={group.date}>
                        <DateSeparator date={group.date} />
                        {group.msgs.map(msg => (
                          <MessageBubble
                            key={msg.id}
                            message={msg}
                            isSelf={msg.senderRole === "super_admin" || msg.senderRole === "admin" || msg.senderId === (admin?.id ?? "super-admin")}
                            onImageClick={url => setPreviewImageUrl(url)}
                            onDelete={handleDeleteMessage}
                          />
                        ))}
                      </div>
                    ))
                  )}
                  <TypingIndicator names={typingUsers} />
                  <div ref={chatEndRef} />
                </div>

                {/* Message Composer */}
                <MessageComposer
                  userId={selectedConv.userId}
                  onSendMessage={sendChatMessage}
                  disabled={chatSending}
                />
              </>
            ) : (
              <EmptyConversation />
            )}
          </div>
        </div>
      </div>

      <ImagePreviewModal url={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
    </SuperAdminLayout>
  );
}
