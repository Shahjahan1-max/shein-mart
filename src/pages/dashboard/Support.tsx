import { useState, useRef, useEffect } from "react";
import {
  LifeBuoy, MessageCircle, Mail, ChevronDown, ChevronUp,
  MessageSquare, ExternalLink, Ticket, HelpCircle, Search, Sparkles, CheckCircle2,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useLang } from "../../contexts/LangContext";
import { useAuth } from "../../contexts/AuthContext";
import { useViewMode } from "../../hooks/useViewMode";
import { DEFAULT_SETTINGS, type ContactChannel, type PlatformSettings, type SupportTicket, type TicketStatus } from "../../data/adminData";
import { useSettings, useSupportTickets, submitSupportTicket } from "../../hooks/useApi";
import { useSupportConversation } from "../../support/hooks/useSupportConversation";
import { useTypingIndicator } from "../../support/hooks/useTypingIndicator";
import { MessageBubble } from "../../support/components/MessageBubble";
import { MessageComposer } from "../../support/components/MessageComposer";
import { ConversationHeader } from "../../support/components/ConversationHeader";
import { DateSeparator } from "../../support/components/DateSeparator";
import { ImagePreviewModal } from "../../support/components/ImagePreviewModal";

function prioritySort(a: ContactChannel, b: ContactChannel): number {
  const order = { Telegram: 0, WhatsApp: 1, Email: 2, Other: 3 };
  return (order[a.platform] ?? 99) - (order[b.platform] ?? 99);
}

export function Support() {
  const { t } = useLang();
  const { user } = useAuth();
  const { viewMode } = useViewMode();
  const [activeTab, setActiveTab] = useState<"livechat" | "tickets" | "faq">("livechat");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [faqSearch, setFaqSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  // Settings for Telegram/Email cards
  const { data: apiSettings } = useSettings<PlatformSettings>();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const contacts: ContactChannel[] = Array.isArray(settings.contacts) ? settings.contacts : DEFAULT_SETTINGS.contacts;
  const enabledContacts = contacts.filter(c => c.enabled).sort(prioritySort);

  // Live WhatsApp-style conversation hook
  const {
    conversation,
    messages,
    loading: chatLoading,
    sending: chatSending,
    send: sendChatMessage,
    markRead,
  } = useSupportConversation({
    userId: user?.id ?? "",
    userName: user?.name ?? "User",
    userEmail: user?.email ?? "",
    senderRole: "user",
  });

  const { notifyTyping } = useTypingIndicator(
    conversation?.id,
    user?.id ?? "",
    user?.name ?? "User",
    { disableReceive: true }
  );

  // Auto-scroll chat to bottom — instant on new messages to avoid the timer-lag feel
  useEffect(() => {
    if (messages.length !== prevMsgCount.current) {
      prevMsgCount.current = messages.length;
      messagesEndRef.current?.scrollIntoView({ behavior: messages.length <= 1 ? "instant" : "smooth" });
    }
    if (messages.length > 0) markRead();
  }, [messages.length, markRead]);

  // Support tickets
  const { data: apiTickets, refetch: refetchTickets } = useSupportTickets(user?.id);
  const myTickets: SupportTicket[] = (apiTickets ?? [])
    .filter(tk => !tk.is_deleted && !tk.user_deleted)
    .map(tk => ({
      id: tk.id,
      userId: tk.userId,
      userName: tk.userName ?? "User",
      userEmail: tk.userEmail ?? "",
      subject: tk.subject,
      message: tk.message,
      date: tk.date,
      status: tk.status as TicketStatus,
      type: tk.type as SupportTicket["type"],
      reply: tk.reply,
    }));

  const [ticketForm, setTicketForm] = useState({ subject: "", message: "" });
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);

  const handleSendTicket = async () => {
    if (!ticketForm.subject || !ticketForm.message) return;
    setTicketSending(true);
    try {
      await submitSupportTicket({
        id: `tkt-${Date.now()}`,
        userId: user?.id ?? "unknown",
        userName: user?.name ?? "Unknown",
        userEmail: user?.email ?? "",
        subject: ticketForm.subject,
        message: ticketForm.message,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "open",
      });
      refetchTickets();
      setTicketSent(true);
      setTicketForm({ subject: "", message: "" });
      setTimeout(() => setTicketSent(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setTicketSending(false);
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: typeof messages }[] = [];
  messages.forEach(msg => {
    const d = new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === d) {
      lastGroup.msgs.push(msg);
    } else {
      groupedMessages.push({ date: d, msgs: [msg] });
    }
  });

  const FAQ_ITEMS = [
    { q: t("faq1q"), a: t("faq1a") },
    { q: t("faq2q"), a: t("faq2a") },
    { q: t("faq3q"), a: t("faq3a") },
    { q: t("faq4q"), a: t("faq4a") },
    { q: t("faq5q"), a: t("faq5a") },
  ];
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const filteredFaqs = FAQ_ITEMS.filter(
    item =>
      item.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <DashboardLayout showBack title={t("support")} backTo="/dashboard" fullHeight>
      <div className={`flex-1 min-h-0 flex flex-col h-full p-2 sm:p-3.5 gap-2.5 ${viewMode === "desktop" ? "w-full" : "w-full"}`}>
        
        {/* Top Header Controls: Tabs + Quick Channels */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-gray-900 p-1.5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-1.5 flex-1">
            <button
              onClick={() => setActiveTab("livechat")}
              className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative ${
                activeTab === "livechat"
                  ? "bg-[#008069] text-white shadow-md"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span>Live Support</span>
            </button>

            <button
              onClick={() => setActiveTab("tickets")}
              className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "tickets"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
            >
              <Ticket className="w-4 h-4 flex-shrink-0" />
              <span>Tickets</span>
              {myTickets.length > 0 && (
                <span className="bg-white/20 border border-white/40 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full ml-0.5">
                  {myTickets.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("faq")}
              className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "faq"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
            >
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
              <span>FAQ</span>
            </button>
          </div>

          {/* Quick Contact Badges */}
          {enabledContacts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {enabledContacts.map(ch => (
                <a
                  key={ch.id}
                  href={ch.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 border ${
                    ch.platform === "Telegram"
                      ? "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100"
                      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                  }`}
                  title={`${ch.title}: ${ch.link}`}
                >
                  {ch.platform === "Telegram" ? <MessageCircle className="w-3.5 h-3.5 text-sky-600" /> : <Mail className="w-3.5 h-3.5 text-amber-600" />}
                  <span>{ch.platform}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── TAB 1: LIVE SUPPORT (FULL HEIGHT CHAT SCREEN - WHATSAPP STYLE) ── */}
        {activeTab === "livechat" && (
          <div className="flex-1 min-h-0 bg-[#efeae2] dark:bg-gray-950 rounded-2xl border border-slate-200 dark:border-gray-800 overflow-hidden shadow-md flex flex-col">
            {/* Chat Room Header */}
            <ConversationHeader conversation={conversation} />

            {/* Messages Feed — WhatsApp light background pattern */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3 sm:p-4 space-y-1 bg-[#efeae2] dark:bg-gray-950 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:16px_16px]">
              {chatLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-500 dark:text-gray-400 font-medium">
                  Connecting to support representative...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-600 dark:text-gray-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#008069] flex items-center justify-center text-white shadow-md">
                    <LifeBuoy className="w-6 h-6" />
                  </div>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white">Welcome to DealX Live Support!</p>
                  <p className="text-xs text-slate-600 dark:text-gray-300 max-w-sm leading-relaxed">
                    Type your query or issue below. A support representative will respond directly in real-time.
                  </p>
                </div>
              ) : (
                groupedMessages.map(group => (
                  <div key={group.date}>
                    <DateSeparator date={group.date} />
                    {group.msgs.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isSelf={msg.senderId === user?.id}
                        onImageClick={url => setPreviewImageUrl(url)}
                      />
                    ))}
                  </div>
                ))
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer — flex-shrink-0 keeps it always visible even when keyboard opens */}
            <div className="flex-shrink-0 z-20 w-full">
              <MessageComposer
                userId={user?.id ?? ""}
                onSendMessage={sendChatMessage}
                onTyping={notifyTyping}
                disabled={chatSending}
              />
            </div>
          </div>
        )}

        {/* ── TAB 2: TICKETS (FULL HEIGHT SCROLLABLE) ── */}
        {activeTab === "tickets" && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            {/* Create Ticket Form */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4 sm:p-5 space-y-4 shadow-sm text-slate-900 dark:text-white">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Submit Support Ticket</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Create a ticket for technical issues or account requests</p>
                </div>
              </div>

              {ticketSent ? (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Ticket submitted successfully! Support staff will review it shortly.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">Subject</label>
                    <input
                      type="text"
                      value={ticketForm.subject}
                      onChange={e => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Brief title of issue..."
                      className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">Message Detail</label>
                    <textarea
                      rows={3}
                      value={ticketForm.message}
                      onChange={e => setTicketForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Describe your issue in detail..."
                      className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 resize-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSendTicket}
                    disabled={!ticketForm.subject || !ticketForm.message || ticketSending}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-sm"
                  >
                    {ticketSending ? "Submitting..." : "Submit Ticket"}
                  </button>
                </div>
              )}
            </div>

            {/* My Tickets List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">My Support Tickets ({myTickets.length})</h4>
              {myTickets.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-8 text-center text-sm text-slate-500 dark:text-gray-400 space-y-1 shadow-xs">
                  <p className="font-bold text-slate-700 dark:text-gray-200">No tickets submitted yet</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Use the form above to submit a new inquiry.</p>
                </div>
              ) : (
                myTickets.map(tk => (
                  <div key={tk.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4 space-y-2 shadow-sm text-slate-900 dark:text-white">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="font-extrabold text-slate-900 dark:text-white text-sm">{tk.subject}</h5>
                      <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                        tk.status === "open"
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                          : tk.status === "resolved"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700"
                      }`}>
                        {tk.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">{tk.message}</p>

                    {tk.reply && (
                      <div className="mt-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-1">
                        <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          Support Staff Reply:
                        </p>
                        <p className="text-xs text-slate-700 dark:text-gray-200 leading-relaxed">{tk.reply}</p>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 dark:text-gray-500 pt-1">{tk.date}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: FAQ (FULL HEIGHT SEARCHABLE) ── */}
        {activeTab === "faq" && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Search Filter */}
            <div className="flex-shrink-0 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder="Search FAQ questions..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary shadow-xs transition-all"
              />
            </div>

            {/* FAQ Items List — Internal scroll only */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {filteredFaqs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 shadow-xs">
                  No matching FAQ questions found.
                </div>
              ) : (
                filteredFaqs.map((item, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                      >
                        <span className="pr-2">{item.q}</span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="p-4 bg-slate-50 text-xs text-slate-600 border-t border-slate-200 leading-relaxed">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      <ImagePreviewModal url={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
    </DashboardLayout>
  );
}
