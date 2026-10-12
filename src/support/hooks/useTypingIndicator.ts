import { useState, useEffect, useCallback, useRef } from "react";
import { setRtdbTyping, subscribeRtdbTyping } from "../services/supportRtdb";
import { sendTypingIndicator } from "../services/supportApi";

interface UseTypingIndicatorOptions {
  disableReceive?: boolean;
  disableSend?: boolean;
}

export function useTypingIndicator(
  conversationId: string | undefined,
  senderId: string,
  senderName: string,
  options?: UseTypingIndicatorOptions
) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimer = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const disableReceive = options?.disableReceive === true;
  const disableSend = options?.disableSend === true;

  // Listen to typing indicators via Firebase RTDB
  useEffect(() => {
    if (!conversationId || disableReceive) {
      setTypingUsers([]);
      return;
    }

    try {
      const unsub = subscribeRtdbTyping(conversationId, activeTypers => {
        const others = activeTypers
          .filter(u => u.senderId !== senderId && u.isTyping)
          .map(u => u.senderName);
        setTypingUsers(others);
      });
      return unsub;
    } catch {
      return () => {};
    }
  }, [conversationId, senderId, disableReceive]);

  // Handle local user typing debounce
  const notifyTyping = useCallback(() => {
    if (!conversationId || disableSend) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setRtdbTyping(conversationId, senderId, senderName, true).catch(() => {});
      sendTypingIndicator(conversationId, senderId, senderName, true).catch(() => {});
    }

    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      isTypingRef.current = false;
      if (conversationId) {
        setRtdbTyping(conversationId, senderId, senderName, false).catch(() => {});
        sendTypingIndicator(conversationId, senderId, senderName, false).catch(() => {});
      }
    }, 3000);
  }, [conversationId, senderId, senderName, disableSend]);

  const stopTypingNow = useCallback(() => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (isTypingRef.current && conversationId && !disableSend) {
      isTypingRef.current = false;
      setRtdbTyping(conversationId, senderId, senderName, false).catch(() => {});
      sendTypingIndicator(conversationId, senderId, senderName, false).catch(() => {});
    }
  }, [conversationId, senderId, senderName, disableSend]);

  return {
    typingUsers,
    notifyTyping,
    stopTypingNow,
  };
}

