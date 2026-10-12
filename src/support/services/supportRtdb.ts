import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  off,
  type DataSnapshot,
} from "firebase/database";
import { getRealtimeDb } from "../../lib/firebaseClient";
import type {
  SupportConversation,
  SupportMessage,
  SendMessagePayload,
} from "../types";

/**
 * Strips undefined values from an object so Firebase RTDB doesn't throw
 * "value argument contains undefined" errors.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && val !== null) {
      clean[key] = val;
    }
  }
  return clean as T;
}

/**
 * Get or create a support conversation in Firebase RTDB.
 * We use `conv-${userId}` as the canonical conversation ID for user support.
 */
/**
 * Get or create a support conversation in Firebase RTDB.
 * We use the userId as the canonical conversation ID for user support.
 */
export async function getOrCreateRtdbConversation(
  userId: string,
  userName: string,
  userEmail?: string,
  userAvatar?: string,
): Promise<SupportConversation> {
  if (!userId) throw new Error("userId is required for support conversation");
  const db = getRealtimeDb();
  // Canonical conversation ID is the userId (without forced conv- prefix)
  const canonicalId = userId.startsWith("conv-") ? userId.slice(5) : userId;
  const legacyId = `conv-${canonicalId}`;

  // Check canonical node first, then fallback to legacy node
  let convRef = ref(db, `supportConversations/${canonicalId}`);
  let snapshot = await get(convRef);
  if (!snapshot.exists()) {
    const legacyRef = ref(db, `supportConversations/${legacyId}`);
    const legacySnap = await get(legacyRef);
    if (legacySnap.exists()) {
      convRef = legacyRef;
      snapshot = legacySnap;
    }
  }

  if (snapshot.exists()) {
    const existing = snapshot.val() as SupportConversation;
    const normId = existing.userId || canonicalId;
    const lastMsg = existing.lastMessage || (existing as any).lastMessageText || "";
    const patch = stripUndefined({
      id: normId,
      userId: normId,
      userName: userName || existing.userName,
      userEmail: userEmail || existing.userEmail,
      lastMessage: lastMsg,
      updatedAt: new Date().toISOString(),
    });
    await update(convRef, patch).catch(() => {});
    return { ...existing, ...patch, id: normId, userId: normId, lastMessage: lastMsg };
  }

  const now = new Date().toISOString();
  const newConv: SupportConversation = stripUndefined({
    id: canonicalId,
    userId: canonicalId,
    userName: userName || "User",
    userEmail: userEmail || "",
    userAvatar: userAvatar || "",
    status: "active",
    lastMessage: "",
    lastMessageAt: now,
    lastMessageSenderId: "",
    unreadForUser: 0,
    unreadForStaff: 0,
    createdAt: now,
    updatedAt: now,
  }) as SupportConversation;

  await set(convRef, newConv);
  return newConv;
}

/**
 * Ensure a conversation exists in RTDB for an admin-initiated chat.
 * Admin can start a conversation with any user using their userId.
 */
export async function ensureRtdbConversationExists(
  userId: string,
  userName: string,
  userEmail?: string,
): Promise<SupportConversation> {
  return getOrCreateRtdbConversation(userId, userName, userEmail);
}

/**
 * Listen to all support conversations in RTDB in real time (for Admin / Super Admin).
 */
export function subscribeRtdbConversations(
  callback: (conversations: SupportConversation[]) => void,
): () => void {
  const db = getRealtimeDb();
  const convsRef = ref(db, "supportConversations");

  const handler = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const val = snapshot.val() as Record<string, SupportConversation>;
    const list: SupportConversation[] = Object.entries(val).map(([rawId, conv]) => {
      const normId = conv.userId || (conv.id ? (conv.id.startsWith("conv-") ? conv.id.slice(5) : conv.id) : (rawId.startsWith("conv-") ? rawId.slice(5) : rawId));
      const lastMsg = conv.lastMessage || (conv as any).lastMessageText || "";
      return {
        ...conv,
        id: normId,
        userId: normId,
        lastMessage: lastMsg,
      };
    });
    // Sort by latest message date or creation date descending
    list.sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    callback(list);
  };

  onValue(convsRef, handler);

  return () => {
    off(convsRef, "value", handler);
  };
}

/**
 * Listen to messages of a single conversation in RTDB in real time.
 */
export function subscribeRtdbMessages(
  convId: string,
  callback: (messages: SupportMessage[]) => void,
): () => void {
  if (!convId) return () => {};
  const db = getRealtimeDb();
  const canonicalId = convId.startsWith("conv-") ? convId.slice(5) : convId;
  const legacyId = `conv-${canonicalId}`;

  const msgsRef = ref(db, `supportMessages/${canonicalId}`);
  const legacyMsgsRef = ref(db, `supportMessages/${legacyId}`);

  let primaryList: SupportMessage[] = [];
  let legacyList: SupportMessage[] = [];

  const emitMerged = () => {
    const map = new Map<string, SupportMessage>();
    for (const m of legacyList) map.set(m.id, m);
    for (const m of primaryList) map.set(m.id, m);
    const sorted = [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    callback(sorted);
  };

  const handler = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      primaryList = [];
      emitMerged();
      return;
    }
    const val = snapshot.val() as Record<string, SupportMessage>;
    primaryList = Object.entries(val).map(([id, msg]) => ({
      ...msg,
      id: msg.id || id,
      conversationId: canonicalId,
    }));
    emitMerged();
  };

  const legacyHandler = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      legacyList = [];
      emitMerged();
      return;
    }
    const val = snapshot.val() as Record<string, SupportMessage>;
    legacyList = Object.entries(val).map(([id, msg]) => ({
      ...msg,
      id: msg.id || id,
      conversationId: canonicalId,
    }));
    emitMerged();
  };

  onValue(msgsRef, handler);
  if (canonicalId !== legacyId) {
    onValue(legacyMsgsRef, legacyHandler);
  }

  return () => {
    off(msgsRef, "value", handler);
    if (canonicalId !== legacyId) {
      off(legacyMsgsRef, "value", legacyHandler);
    }
  };
}

/**
 * Send a message via Firebase Realtime Database.
 * Also atomically updates conversation's last message, unread counters, and timestamp.
 * Strips undefined values to prevent Firebase RTDB errors.
 */
export async function sendRtdbMessage(payload: SendMessagePayload): Promise<SupportMessage> {
  const db = getRealtimeDb();
  const convId = payload.conversationId;
  const canonicalId = convId.startsWith("conv-") ? convId.slice(5) : convId;

  const msgsRef = ref(db, `supportMessages/${canonicalId}`);
  const newMsgRef = push(msgsRef);
  const msgId = newMsgRef.key || `msg-${Date.now()}`;
  const now = new Date().toISOString();

  const isStaff = payload.senderRole === "admin" || payload.senderRole === "super_admin";

  // Build message object without undefined fields
  const message: SupportMessage = stripUndefined({
    id: msgId,
    conversationId: canonicalId,
    senderId: payload.senderId,
    senderRole: payload.senderRole,
    senderName: payload.senderName,
    type: payload.type || "text",
    text: payload.text,
    imageUrl: payload.imageUrl,
    imagePath: payload.imagePath,
    imageFileName: payload.imageFileName,
    imageSize: payload.imageSize,
    status: "sent",
    createdAt: now,
  }) as SupportMessage;

  // 1. Instant WebSocket write for the message
  await set(newMsgRef, message);

  // 2. Update conversation metadata
  const convRef = ref(db, `supportConversations/${canonicalId}`);
  const lastMsgPreview = payload.type === "image" ? (payload.text ? `📷 ${payload.text.substring(0, 80)}` : "📷 Image") : (payload.text || "");

  const convUpdate = stripUndefined({
    id: canonicalId,
    userId: canonicalId,
    userName: payload.senderRole === "user" ? payload.senderName : undefined,
    lastMessage: lastMsgPreview,
    lastMessageText: lastMsgPreview,
    lastMessageId: msgId,
    lastMessageAt: now,
    lastMessageSenderId: payload.senderId,
    lastMessageSenderRole: payload.senderRole,
    updatedAt: now,
  });

  void update(convRef, convUpdate).catch(() => {});

  return message;
}

/**
 * Mark a conversation read in RTDB.
 */
export async function markRtdbConversationRead(
  convId: string,
  readerRole: "user" | "admin" | "super_admin",
): Promise<void> {
  if (!convId) return;
  const db = getRealtimeDb();
  const convRef = ref(db, `supportConversations/${convId}`);

  if (readerRole === "user") {
    await update(convRef, { unreadForUser: 0 }).catch(() => {});
  } else {
    await update(convRef, { unreadForStaff: 0 }).catch(() => {});
  }
}

export async function markRtdbMessagesRead(
  convId: string,
  readerRole: 'user' | 'admin' | 'super_admin',
): Promise<void> {
  if (!convId) return;
  const db = getRealtimeDb();
  const msgsRef = ref(db, `supportMessages/${convId}`);
  const snapshot = await get(msgsRef);
  if (!snapshot.exists()) return;
  const msgs = snapshot.val() as Record<string, any>;
  const updates: Record<string, any> = {};
  const isStaffReader = readerRole === 'admin' || readerRole === 'super_admin';
  for (const [key, msg] of Object.entries(msgs)) {
    if (!msg || msg.status === 'read') continue;
    const isMsgFromUser = msg.senderRole === 'user';
    const isMsgFromStaff = msg.senderRole === 'admin' || msg.senderRole === 'super_admin';
    // Staff reading => mark user messages as read
    // User reading => mark staff messages as read  
    if ((isStaffReader && isMsgFromUser) || (!isStaffReader && isMsgFromStaff)) {
      updates[`${key}/status`] = 'read';
      updates[`${key}/readAt`] = new Date().toISOString();
    }
  }
  if (Object.keys(updates).length > 0) {
    await update(msgsRef, updates).catch(() => {});
  }
}

/**
 * Delete a single message from RTDB (Super Admin only).
 */
export async function deleteRtdbMessage(
  convId: string,
  messageId: string,
): Promise<void> {
  if (!convId || !messageId) return;
  const db = getRealtimeDb();
  const msgRef = ref(db, `supportMessages/${convId}/${messageId}`);
  await set(msgRef, null);
}

/**
 * Delete an entire conversation and all its messages from RTDB.
 */
export async function deleteRtdbConversation(
  convId: string,
): Promise<void> {
  if (!convId) return;
  const db = getRealtimeDb();
  // Delete all messages
  await set(ref(db, `supportMessages/${convId}`), null).catch(() => {});
  // Delete typing indicators
  await set(ref(db, `supportTyping/${convId}`), null).catch(() => {});
  // Delete conversation record
  await set(ref(db, `supportConversations/${convId}`), null).catch(() => {});
}

/**
 * Send typing indicator state to RTDB.
 */
export async function setRtdbTyping(
  convId: string,
  senderId: string,
  senderName: string,
  isTyping: boolean,
): Promise<void> {
  if (!convId || !senderId) return;
  const db = getRealtimeDb();
  const typingRef = ref(db, `supportTyping/${convId}/${senderId}`);

  if (isTyping) {
    await set(typingRef, stripUndefined({
      senderId,
      senderName,
      isTyping: true,
      timestamp: Date.now(),
    })).catch(() => {});
  } else {
    await set(typingRef, null).catch(() => {});
  }
}

/**
 * Subscribe to typing indicators for a conversation in RTDB.
 */
export function subscribeRtdbTyping(
  convId: string,
  callback: (typingUsers: Array<{ senderId: string; senderName: string; isTyping: boolean }>) => void,
): () => void {
  if (!convId) return () => {};
  const db = getRealtimeDb();
  const typingRef = ref(db, `supportTyping/${convId}`);

  const handler = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const val = snapshot.val() as Record<string, { senderId: string; senderName: string; isTyping: boolean; timestamp?: number }>;
    const now = Date.now();
    const active = Object.values(val).filter(u => u && u.isTyping && (now - (u.timestamp || 0)) < 10000);
    callback(active);
  };

  onValue(typingRef, handler);

  return () => {
    off(typingRef, "value", handler);
  };
}
