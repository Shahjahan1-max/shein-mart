import { useState, useEffect, useCallback, useRef } from "react";
import type { SupportConversation, SupportMessage, SenderRole } from "../types";
import {
  getOrCreateRtdbConversation,
  subscribeRtdbMessages,
  sendRtdbMessage,
  markRtdbConversationRead,
  markRtdbMessagesRead,
} from "../services/supportRtdb";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markConversationRead,
} from "../services/supportApi";

interface UseSupportConversationOptions {
  userId: string;
  userName: string;
  userEmail?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: SenderRole;
}

function mergeMessageLists(existing: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  const byId = new Map(existing.map(m => [m.id, m]));
  for (const msg of incoming) {
    if (msg.id && !msg.id.startsWith("optimistic-")) {
      // Replace matching optimistic message (same text or same image and same sender)
      const optKey = [...byId.keys()].find(
        k =>
          k.startsWith("optimistic-") &&
          byId.get(k)?.senderRole === msg.senderRole &&
          (byId.get(k)?.text === msg.text ||
            (msg.type === "image" && byId.get(k)?.type === "image"))
      );
      if (optKey) byId.delete(optKey);
    }
    byId.set(msg.id, msg);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

const conversationCache = new Map<string, SupportMessage[]>();

export function useSupportConversation({
  userId,
  userName,
  userEmail,
  senderId,
  senderName,
  senderRole = "user",
}: UseSupportConversationOptions) {
  const canonicalUserId = (userId || "").startsWith("conv-") ? (userId || "").slice(5) : (userId || "");
  const cachedMessages = conversationCache.get(canonicalUserId) || [];

  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>(cachedMessages);
  const [loading, setLoading] = useState(!conversationCache.has(canonicalUserId));
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const isMounted = useRef(true);
  const unsubscribeRtdb = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (unsubscribeRtdb.current) {
        unsubscribeRtdb.current();
        unsubscribeRtdb.current = null;
      }
    };
  }, []);

  // Sync messages into module-level memory cache for 0ms instant chat switching
  const updateMessages = useCallback((updater: SupportMessage[] | ((prev: SupportMessage[]) => SupportMessage[])) => {
    setMessages(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (canonicalUserId) {
        conversationCache.set(canonicalUserId, next);
      }
      return next;
    });
  }, [canonicalUserId]);

  // Initialize conversation — RTDB with REST fallback
  const initConversation = useCallback(async () => {
    if (!canonicalUserId) {
      setLoading(false);
      return;
    }
    if (!conversationCache.has(canonicalUserId)) {
      setLoading(true);
    }
    setError(null);
    try {
      // 1. Primary: RTDB
      let conv: SupportConversation | null = null;
      try {
        conv = await getOrCreateRtdbConversation(canonicalUserId, userName, userEmail);
      } catch (rtdbErr) {
        console.warn("[useSupportConversation] RTDB getOrCreate error, falling back to REST:", rtdbErr);
      }

      // 2. Fallback or parallel REST initialization
      if (!conv) {
        try {
          conv = await getOrCreateConversation(canonicalUserId, userName, userEmail);
        } catch (restErr) {
          console.warn("[useSupportConversation] REST getOrCreate error:", restErr);
        }
      }

      if (!isMounted.current || !conv) return;
      setConversation(conv);

      // Load initial messages from REST in parallel
      try {
        const restMsgs = await getMessages(conv.id);
        if (isMounted.current && restMsgs.data.length > 0) {
          updateMessages(prev => mergeMessageLists(prev, restMsgs.data));
        }
      } catch {
        // Non-critical
      }
    } catch (err) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load conversation.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [canonicalUserId, userName, userEmail, updateMessages]);

  // Attach Realtime Database listener + SSE fallback listener once we have a convId
  useEffect(() => {
    if (!conversation?.id) return;
    const convId = conversation.id;

    if (unsubscribeRtdb.current) {
      unsubscribeRtdb.current();
      unsubscribeRtdb.current = null;
    }

    // 1. RTDB live listener
    try {
      const unsub = subscribeRtdbMessages(convId, rtdbMsgs => {
        if (!isMounted.current) return;
        updateMessages(prev => mergeMessageLists(prev, rtdbMsgs));
        setLoading(false);
      });
      unsubscribeRtdb.current = unsub;
    } catch (err) {
      console.warn("[Support RTDB] subscription error:", err);
    }

    // 2. Server-Sent Events (SSE) data-change listener
    const sseHandler = (e: Event) => {
      const col = (e as CustomEvent<{ collection?: string; id?: string }>).detail?.collection;
      if (col === "supportMessages" || col === "supportConversations") {
        void getMessages(convId).then(res => {
          if (isMounted.current && res.data.length > 0) {
            updateMessages(prev => mergeMessageLists(prev, res.data));
          }
        }).catch(() => {});
      }
    };
    window.addEventListener("ds:data-changed", sseHandler);

    return () => {
      if (unsubscribeRtdb.current) {
        unsubscribeRtdb.current();
        unsubscribeRtdb.current = null;
      }
      window.removeEventListener("ds:data-changed", sseHandler);
    };
  }, [conversation?.id, updateMessages]);

  // Clear or rehydrate state when userId changes
  useEffect(() => {
    const cached = conversationCache.get(canonicalUserId) || [];
    setMessages(cached);
    setConversation(null);
    setError(null);
    setLoading(!conversationCache.has(canonicalUserId));
    if (unsubscribeRtdb.current) {
      unsubscribeRtdb.current();
      unsubscribeRtdb.current = null;
    }
  }, [canonicalUserId]);

  useEffect(() => {
    if (userId && userName) initConversation();
  }, [userId, userName, initConversation]);

  const sendingRef = useRef(false);

  const send = useCallback(
    async (
      text: string,
      imageUrl?: string,
      imageData?: { path?: string; fileName?: string; size?: number },
    ) => {
      if (!conversation?.id || sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);

      const actualSenderId = senderId || userId;
      const actualSenderName = senderName || userName;
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const optimisticMsg: SupportMessage = {
        id: tempId,
        conversationId: conversation.id,
        senderId: actualSenderId,
        senderRole,
        senderName: actualSenderName,
        type: imageUrl ? "image" : "text",
        text: text || undefined,
        imageUrl: imageUrl || undefined,
        status: "sending",
        createdAt: now,
        _optimistic: true,
      };

      setMessages(prev => [...prev, optimisticMsg]);

      // Build payload — only pass defined values
      const payload: Parameters<typeof sendRtdbMessage>[0] = {
        conversationId: conversation.id,
        senderId: actualSenderId,
        senderRole,
        senderName: actualSenderName,
        type: (imageUrl ? "image" : "text") as "image" | "text",
        ...(text ? { text } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageData?.path ? { imagePath: imageData.path } : {}),
        ...(imageData?.fileName ? { imageFileName: imageData.fileName } : {}),
        ...(imageData?.size ? { imageSize: imageData.size } : {}),
      };

      let sentSuccess = false;
      let confirmedMsg: SupportMessage | null = null;

      try {
        // 1. Primary fast channel: RTDB
        try {
          confirmedMsg = await sendRtdbMessage(payload);
          sentSuccess = true;
        } catch (rtdbErr) {
          console.warn("[useSupportConversation] RTDB send failed, attempting REST send:", rtdbErr);
        }

        // 2. Dual sync to backend REST (runs concurrently or as fallback)
        try {
          const restMsg = await sendMessage(payload);
          if (!confirmedMsg) confirmedMsg = restMsg;
          sentSuccess = true;
        } catch (restErr) {
          if (!sentSuccess) console.warn("[useSupportConversation] REST send failed:", restErr);
        }

        if (!isMounted.current) return;

        if (sentSuccess && confirmedMsg) {
          // Replace optimistic with confirmed message
          setMessages(prev => prev.map(m => (m.id === tempId ? { ...confirmedMsg!, status: "sent" } : m)));
          setConversation(prev =>
            prev
              ? {
                  ...prev,
                  lastMessage: imageUrl
                    ? text
                      ? `📷 ${text.substring(0, 80)}`
                      : "📷 Image"
                    : text.substring(0, 100),
                  lastMessageAt: now,
                }
              : prev,
          );
        } else {
          throw new Error("Message could not be sent.");
        }
      } catch (err) {
        if (!isMounted.current) return;
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...m, status: "failed" as const } : m)),
        );
        throw err;
      } finally {
        sendingRef.current = false;
        if (isMounted.current) setSending(false);
      }
    },
    [conversation?.id, userId, senderId, senderName, senderRole, userName],
  );

  const markRead = useCallback(async () => {
    if (!conversation?.id) return;
    try {
      await markRtdbConversationRead(conversation.id, senderRole);
      await markRtdbMessagesRead(conversation.id, senderRole);
      void markConversationRead(conversation.id, senderRole).catch(() => {});
      setConversation(prev => {
        if (!prev) return prev;
        const isStaff = senderRole === "admin" || senderRole === "super_admin";
        return { ...prev, [isStaff ? "unreadForStaff" : "unreadForUser"]: 0 };
      });
    } catch {
      // Non-critical
    }
  }, [conversation?.id, senderRole]);

  return {
    conversation,
    messages,
    loading,
    loadingMessages,
    error,
    sending,
    hasMore: false,
    send,
    markRead,
    refetch: () => conversation && initConversation(),
  };
}
