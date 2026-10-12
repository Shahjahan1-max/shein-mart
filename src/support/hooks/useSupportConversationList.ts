import { useState, useEffect, useCallback, useRef } from "react";
import type { SupportConversation } from "../types";
import { getAllConversations } from "../services/supportApi";
import { subscribeRtdbConversations } from "../services/supportRtdb";

export function useSupportConversationList(status: "active" | "closed" | "all" = "all") {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isMounted = useRef(true);
  const unsubRtdb = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (unsubRtdb.current) {
        unsubRtdb.current();
        unsubRtdb.current = null;
      }
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await getAllConversations({ status, pageSize: 100 });
      if (!isMounted.current) return;
      if (res.data.length > 0) {
        setConversations(prev => {
          const map = new Map<string, SupportConversation>();
          for (const c of prev) {
            const normKey = c.userId || (c.id.startsWith("conv-") ? c.id.slice(5) : c.id);
            map.set(normKey, { ...c, id: normKey, userId: normKey });
          }
          for (const c of res.data) {
            const normKey = c.userId || (c.id.startsWith("conv-") ? c.id.slice(5) : c.id);
            const existing = map.get(normKey);
            map.set(normKey, { ...existing, ...c, id: normKey, userId: normKey });
          }
          const list = [...map.values()];
          list.sort((a, b) => {
            const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
            const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
            return timeB - timeA;
          });
          return list;
        });
      }
      setError(null);
    } catch (err) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch conversations.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // 1. Initial REST fetch
    fetchConversations();

    // 2. Realtime Database Subscription for instant zero-latency updates
    try {
      unsubRtdb.current = subscribeRtdbConversations(rtdbConvs => {
        if (!isMounted.current) return;
        setConversations(prev => {
          const map = new Map<string, SupportConversation>();
          for (const c of prev) {
            const normKey = c.userId || (c.id.startsWith("conv-") ? c.id.slice(5) : c.id);
            map.set(normKey, { ...c, id: normKey, userId: normKey });
          }
          for (const c of rtdbConvs) {
            const normKey = c.userId || (c.id.startsWith("conv-") ? c.id.slice(5) : c.id);
            const existing = map.get(normKey);
            map.set(normKey, { ...existing, ...c, id: normKey, userId: normKey });
          }
          const list = [...map.values()];
          list.sort((a, b) => {
            const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
            const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
            return timeB - timeA;
          });
          return list;
        });
        setLoading(false);
      });
    } catch (rtdbErr) {
      console.warn("[Support RTDB] Convs subscription error:", rtdbErr);
    }

    // 3. Fallback SSE listener
    const sseHandler = (e: Event) => {
      const col = (e as CustomEvent<{ collection?: string }>).detail?.collection;
      if (col === "supportConversations" || col === "supportMessages") {
        fetchConversations();
      }
    };
    window.addEventListener("ds:data-changed", sseHandler);

    return () => {
      if (unsubRtdb.current) {
        unsubRtdb.current();
        unsubRtdb.current = null;
      }
      window.removeEventListener("ds:data-changed", sseHandler);
    };
  }, [fetchConversations]);

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (conv.userName || "").toLowerCase().includes(q) ||
      (conv.userEmail && conv.userEmail.toLowerCase().includes(q)) ||
      (conv.userId || "").toLowerCase().includes(q) ||
      (conv.lastMessage || "").toLowerCase().includes(q)
    );
  });

  const totalUnreadStaff = conversations.reduce((sum, c) => sum + (c.unreadForStaff || 0), 0);

  return {
    conversations: filteredConversations,
    allConversations: conversations,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    totalUnreadStaff,
    refetch: fetchConversations,
  };
}

