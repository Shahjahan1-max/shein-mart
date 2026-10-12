import { useState, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import AdminLayout from "./AdminLayout";
import {
  SUSPENSION_APPEAL_SUBJECT, SupportTicket, TicketStatus, UserStatus,
  type ExtraTaskApproval,
} from "../../data/adminData";
import { useAdmin } from "../../contexts/AdminContext";
import {
  Search, MessageSquare, ChevronDown, ChevronUp, Send,
  ShieldAlert, ShieldCheck, Zap, CheckCircle, XCircle,
  UserX, UserCheck, Loader2, Wallet, HeadphonesIcon, Filter,
} from "lucide-react";
import {
  saveGenericFirebaseDoc, useFirebaseDoc, useSupportTickets,
  updateTicket as apiUpdateTicket,
  updateUser as apiUpdateUser,
} from "../../hooks/useApi";

// Support module hooks & components
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
import type { SupportConversation, SupportMessage } from "../../support/types";

type TypeFilter = "all" | "appeals" | "extra_tasks" | "wallet_changes" | "regular";

const UNSUSPEND_DEFAULT_REPLY =
  "Your account has been restored. You can now access the platform again. If you have any questions, please don't hesitate to contact us.";

function appendFirebaseAuditLog(
  adminId: string,
  adminUsername: string,
  userId: string,
  userName: string,
  action: "TICKET_DELETE_ADMIN" | "TICKET_DELETE_ON_BEHALF",
  meta?: Record<string, string>,
) {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  void saveGenericFirebaseDoc("auditLogs", id, {
    id,
    adminId,
    adminUsername,
    userId,
    userName,
    action,
    meta,
    timestamp: new Date().toISOString(),
  });
}

function isAppealTicket(ticket: SupportTicket): boolean {
  return ticket.type === "appeal" || ticket.subject === SUSPENSION_APPEAL_SUBJECT;
}

function isExtraTaskTicket(ticket: SupportTicket): boolean {
  return ticket.type === "extra_task";
}

function isWalletChangeTicket(ticket: SupportTicket): boolean {
  return ticket.type === "wallet_change";
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, string> = {
    open: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
    in_progress: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800",
    resolved: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
    closed: "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function AppealBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-900/40 text-orange-400 border border-orange-800">
      <ShieldAlert className="w-3 h-3" />
      Appeal
    </span>
  );
}

function ExtraTaskBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-900/40 text-amber-400 border border-amber-800">
      <Zap className="w-3 h-3" />
      Extra Task Request
    </span>
  );
}

function WalletChangeBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-300 border border-blue-800">
      <Wallet className="w-3 h-3" />
      Wallet Change
    </span>
  );
}

export default function AdminSupport() {
  const { admin } = useAdmin();
  const [activeTab, setActiveTab] = useState<"workspace" | "tickets">("workspace");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // ── Tab 1: WhatsApp Support Workspace State ──
  const [selectedConv, setSelectedConv] = useState<SupportConversation | null>(null);
  const {
    conversations,
    loading: convsLoading,
    searchQuery,
    setSearchQuery,
    totalUnreadStaff,
  } = useSupportConversationList();

  const targetUserId = selectedConv?.userId || selectedConv?.id || "";
  const targetUserName = selectedConv?.userName || "User";
  const targetUserEmail = selectedConv?.userEmail || "";

  const {
    conversation: activeConv,
    messages: chatMessages,
    loading: chatLoading,
    sending: chatSending,
    send: sendChatMessage,
    markRead: markChatRead,
  } = useSupportConversation({
    userId: targetUserId,
    userName: targetUserName,
    userEmail: targetUserEmail,
    senderId: admin?.id ?? "admin",
    senderName: admin?.username ?? "Support Staff",
    senderRole: admin?.role === "super_admin" ? "super_admin" : "admin",
  });

  const { typingUsers } = useTypingIndicator(
    selectedConv?.id,
    admin?.id ?? "admin",
    admin?.username ?? "Support Admin",
    { disableSend: true }
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevChatCount = useRef(0);

  // Auto-select user conversation when navigated from Users page via ?userId= param
  const searchStr = useSearch();
  useEffect(() => {
    if (!searchStr) return;
    const params = new URLSearchParams(searchStr);
    const targetUserId = params.get("userId");
    const targetUserName = params.get("userName") || "User";
    const targetUserEmail = params.get("userEmail") || "";
    if (!targetUserId) return;

    // Switch to the workspace tab
    setActiveTab("workspace");

    // Check if conversation already exists in RTDB list; otherwise create a stub
    import("../../support/services/supportRtdb").then(({ getOrCreateRtdbConversation }) => {
      getOrCreateRtdbConversation(targetUserId, targetUserName, targetUserEmail)
        .then(conv => {
          setSelectedConv(conv);
        })
        .catch(() => {
          // Fallback: create a minimal local stub so admin can chat
          setSelectedConv({
            id: targetUserId,
            userId: targetUserId,
            userName: targetUserName,
            userEmail: targetUserEmail,
            userAvatar: "",
            status: "active",
            lastMessage: "",
            lastMessageAt: new Date().toISOString(),
            lastMessageSenderId: "",
            unreadForUser: 0,
            unreadForStaff: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);

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

  // ── Tab 2: Legacy Tickets State ──
  const { data: apiTickets, refetch: refetchTickets } = useSupportTickets();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tickets: SupportTicket[] = (apiTickets ?? [])
    .filter(t => !t.is_deleted)
    .map(t => ({
      id: t.id, userId: t.userId, userName: t.userName ?? "User",
      userEmail: t.userEmail ?? "", subject: t.subject, message: t.message,
      date: t.date, status: t.status as TicketStatus, type: t.type as SupportTicket["type"],
      reply: t.reply, walletChange: t.walletChange, is_deleted: t.is_deleted, user_deleted: t.user_deleted,
    }));

  const filteredTickets = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = (t.userName || "").toLowerCase().includes(q) ||
      (t.userEmail || "").toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q) ||
      (t.message || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchType =
      typeFilter === "all" ? true :
      typeFilter === "appeals" ? isAppealTicket(t) :
      typeFilter === "extra_tasks" ? isExtraTaskTicket(t) :
      typeFilter === "wallet_changes" ? isWalletChangeTicket(t) :
      (!isAppealTicket(t) && !isExtraTaskTicket(t) && !isWalletChangeTicket(t));
    return matchSearch && matchStatus && matchType;
  });

  async function handleUpdateTicket(updated: SupportTicket) {
    try {
      await apiUpdateTicket(updated.id, updated);
      refetchTickets();
      setToastMessage("Ticket updated successfully");
    } catch (err) { console.error(err); }
  }

  const isSuperAdmin = admin?.role === "superadmin" || admin?.role === "super_admin";

  return (
    <AdminLayout title="Support Center">
      <div className="space-y-4">
        {/* Top Bar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#008069]/10 border border-[#008069]/30 flex items-center justify-center text-[#008069]">
              <HeadphonesIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Realtime Support Workspace
                {totalUnreadStaff > 0 && (
                  <span className="bg-[#008069] text-white text-xs px-2 py-0.5 rounded-full font-extrabold shadow-sm">
                    {totalUnreadStaff} New
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Enterprise support desk & live user messaging center</p>
            </div>
          </div>

          {/* Workspace / Tickets Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-gray-950 p-1 rounded-xl border border-slate-200 dark:border-gray-800">
            <button
              onClick={() => setActiveTab("workspace")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "workspace"
                  ? "bg-[#008069] text-white shadow-md"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Live Workspace
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "tickets"
                  ? "bg-[#008069] text-white shadow-md"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
              }`}
            >
              <Filter className="w-4 h-4" />
              Tickets & Appeals ({tickets.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Live Support Workspace (WhatsApp-style splitscreen) */}
        {activeTab === "workspace" && (
          <div className="grid grid-cols-1 md:grid-cols-12 bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden h-[calc(100vh-210px)] min-h-[580px] max-h-[820px] shadow-lg">
            {/* Sidebar Conversation List — Always Persistent & Fixed */}
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

            {/* Main Chat Area */}
            <div className={`md:col-span-8 lg:col-span-8 h-full flex flex-col min-h-0 ${!selectedConv ? "hidden md:flex" : "flex"}`}>
              {selectedConv ? (
                <>
                  <ConversationHeader
                    conversation={selectedConv}
                    onBack={() => setSelectedConv(null)}
                    isStaff
                  />

                  {/* Messages Feed */}
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-1 bg-[#efeae2] dark:bg-gray-950 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:16px_16px]">
                    {chatLoading && chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500 dark:text-gray-400">
                        <div className="w-8 h-8 rounded-full border-3 border-[#008069] border-t-transparent animate-spin" />
                        <p className="text-sm font-semibold">Loading conversation...</p>
                        <p className="text-xs text-slate-400 dark:text-gray-500">Syncing live messages with Firebase</p>
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 dark:text-gray-500">
                        <MessageSquare className="w-8 h-8 opacity-40" />
                        <p className="text-sm font-medium">No messages yet in this conversation.</p>
                        <p className="text-xs text-slate-400">Type a message below to start the support session.</p>
                      </div>
                    ) : (
                      groupedChatMessages.map(group => (
                        <div key={group.date}>
                          <DateSeparator date={group.date} />
                          {group.msgs.map(msg => (
                            <MessageBubble
                              key={msg.id}
                              message={msg}
                              isSelf={msg.senderRole === "admin" || msg.senderRole === "super_admin" || msg.senderId === (admin?.id ?? "admin")}
                              onImageClick={url => setPreviewImageUrl(url)}
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
                    userId={selectedConv.userId || selectedConv.id}
                    onSendMessage={sendChatMessage}
                    disabled={chatSending}
                  />
                </>
              ) : (
                <EmptyConversation />
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Legacy Tickets & Appeals Management */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 dark:text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tickets by user, email, subject..."
                  className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as TicketStatus | "all")}
                  className="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-gray-200 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as TypeFilter)}
                  className="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-gray-200 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="appeals">Appeals Only</option>
                  <option value="wallet_changes">Wallet Changes Only</option>
                  <option value="extra_tasks">Extra Tasks Only</option>
                  <option value="regular">Regular Tickets</option>
                </select>
              </div>
            </div>

            {/* Tickets Table / List */}
            <div className="space-y-3">
              {filteredTickets.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-gray-400 shadow-sm">
                  No tickets match the selected filters.
                </div>
              ) : (
                filteredTickets.map(tk => (
                  <div key={tk.id} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tk.subject}</h4>
                          {isAppealTicket(tk) && <AppealBadge />}
                          {isExtraTaskTicket(tk) && <ExtraTaskBadge />}
                          {isWalletChangeTicket(tk) && <WalletChangeBadge />}
                          <StatusBadge status={tk.status} />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 font-medium">
                          {tk.userName || "User"} · {tk.userEmail || "No Email"} · {tk.date}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-gray-950/80 rounded-xl p-3 text-xs text-slate-800 dark:text-gray-200 border border-slate-100 dark:border-gray-800 leading-relaxed">
                      {tk.message}
                    </div>

                    {/* Special Wallet Change Actions */}
                    {isWalletChangeTicket(tk) && tk.walletChange && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl p-3 text-xs space-y-2">
                        <p className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <Wallet className="w-4 h-4" /> Requested Wallet Change:
                        </p>
                        <p className="text-slate-800 dark:text-gray-200 font-mono">Address: {tk.walletChange.requestedWallet} ({tk.walletChange.protocol || "TRC20"})</p>
                        {tk.walletChange.status === "pending" && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                handleUpdateTicket({
                                  ...tk,
                                  status: "resolved",
                                  reply: "Your wallet change request has been approved and updated.",
                                  walletChange: { ...tk.walletChange, status: "approved" },
                                });
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
                            >
                              Approve Wallet Change
                            </button>
                            <button
                              onClick={() => {
                                handleUpdateTicket({
                                  ...tk,
                                  status: "resolved",
                                  reply: "Your wallet change request was reviewed and not approved.",
                                  walletChange: { ...tk.walletChange, status: "rejected" },
                                });
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {tk.reply && (
                      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3 text-xs space-y-1">
                        <p className="font-bold text-purple-700 dark:text-purple-300">Staff Reply:</p>
                        <p className="text-slate-800 dark:text-gray-200">{tk.reply}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <ImagePreviewModal url={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
    </AdminLayout>
  );
}
