// ─── Support Chat Type Definitions ───────────────────────────────────────────

export type ConversationStatus = "active" | "closed";
export type MessageType = "text" | "image";
export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type SenderRole = "user" | "admin" | "super_admin";

export interface SupportConversation {
  id: string;              // = userId (one conversation per user)
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  status: ConversationStatus;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadForUser: number;
  unreadForStaff: number;
  assignedAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  senderName: string;
  type: MessageType;
  text?: string;
  imageUrl?: string;
  imagePath?: string;
  imageFileName?: string;
  imageSize?: number;
  status: MessageStatus;
  readAt?: string;
  createdAt: string;
  updatedAt?: string;
  // Optimistic UI flag
  _optimistic?: boolean;
}

export interface TypingIndicator {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  isTyping: boolean;
  expiresAt: string;
  updatedAt: string;
}

export interface SendMessagePayload {
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  senderName: string;
  type: MessageType;
  text?: string;
  imageUrl?: string;
  imagePath?: string;
  imageFileName?: string;
  imageSize?: number;
}

export interface UploadedSupportImage {
  url: string;
  path?: string;
  fileName: string;
  contentType: string;
}
