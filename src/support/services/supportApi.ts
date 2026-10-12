import { api } from "../../lib/apiClient";
import type {
  SupportConversation,
  SupportMessage,
  SendMessagePayload,
  UploadedSupportImage,
} from "../types";

// ─── Conversations ─────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  userId: string,
  userName: string,
  userEmail?: string,
  userAvatar?: string,
): Promise<SupportConversation> {
  const res = await api.post<{ success: boolean; data: SupportConversation }>(
    "/api/support/conversations",
    { userId, userName, userEmail, userAvatar },
  );
  return res.data;
}

export async function getUserConversation(userId: string): Promise<SupportConversation | null> {
  const res = await api.get<{ success: boolean; data: SupportConversation | null }>(
    `/api/support/conversations?userId=${encodeURIComponent(userId)}`,
  );
  return res.data ?? null;
}

export async function getAllConversations(params: {
  pageSize?: number;
  cursor?: string | null;
  status?: "active" | "closed" | "all";
} = {}): Promise<{ data: SupportConversation[]; hasMore: boolean; nextCursor: string | null }> {
  const sp = new URLSearchParams();
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.status && params.status !== "all") sp.set("status", params.status);
  const qs = sp.toString();
  const res = await api.get<{ success: boolean; data: SupportConversation[]; hasMore: boolean; nextCursor: string | null }>(
    `/api/support/conversations${qs ? `?${qs}` : ""}`,
    { requiresAdmin: true },
  );
  return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
}

export async function updateConversation(
  convId: string,
  patch: Partial<Pick<SupportConversation, "status" | "unreadForUser" | "unreadForStaff" | "assignedAdminId">>,
): Promise<SupportConversation> {
  const res = await api.patch<{ success: boolean; data: SupportConversation }>(
    `/api/support/conversations/${encodeURIComponent(convId)}`,
    patch,
  );
  return res.data;
}

export async function markConversationRead(
  convId: string,
  readerRole: "user" | "admin" | "super_admin",
): Promise<void> {
  await api.post<{ success: boolean }>(
    `/api/support/conversations/${encodeURIComponent(convId)}/read`,
    { readerRole },
  );
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(
  convId: string,
  params: { pageSize?: number; cursor?: string | null } = {},
): Promise<{ data: SupportMessage[]; hasMore: boolean; nextCursor: string | null }> {
  const sp = new URLSearchParams();
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  const res = await api.get<{ success: boolean; data: SupportMessage[]; hasMore: boolean; nextCursor: string | null }>(
    `/api/support/conversations/${encodeURIComponent(convId)}/messages${qs ? `?${qs}` : ""}`,
  );
  return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
}

export async function sendMessage(payload: SendMessagePayload): Promise<SupportMessage> {
  const res = await api.post<{ success: boolean; data: SupportMessage }>(
    `/api/support/conversations/${encodeURIComponent(payload.conversationId)}/messages`,
    payload,
    { timeoutMs: 60_000 }
  );
  return res.data;
}

// ─── Typing ───────────────────────────────────────────────────────────────────

export async function sendTypingIndicator(
  conversationId: string,
  senderId: string,
  senderName: string,
  isTyping: boolean,
): Promise<void> {
  try {
    await api.post<{ success: boolean }>("/api/support/typing", {
      conversationId,
      senderId,
      senderName,
      isTyping,
    });
  } catch {
    // Typing indicators are non-critical; silently ignore errors
  }
}

export async function getTypingIndicators(convId: string): Promise<Array<{
  senderId: string;
  senderName: string;
  isTyping: boolean;
  expiresAt: string;
}>> {
  try {
    const res = await api.get<{ success: boolean; data: Array<{ senderId: string; senderName: string; isTyping: boolean; expiresAt: string }> }>(
      `/api/support/typing/${encodeURIComponent(convId)}`,
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

export async function uploadSupportImage(
  userId: string,
  file: File,
): Promise<UploadedSupportImage> {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB input limit
  if (file.size > MAX_SIZE) {
    throw new Error("Image too large. Maximum 10MB allowed.");
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPEG, PNG, GIF, and WebP images are allowed.");
  }

  // Compress image on client canvas to ensure fast transfer (< 200KB payload)
  const dataUrl = await compressImageFile(file);
  try {
    const res = await api.post<{ success: boolean; data: UploadedSupportImage }>(
      "/api/support/images/upload",
      {
        userId,
        conversationId: userId,
        dataUrl,
        fileName: file.name,
        contentType: file.type,
      },
      { timeoutMs: 60_000 }
    );
    if (res?.data?.url) {
      return res.data;
    }
  } catch (err) {
    console.warn("Support image server upload failed; falling back to DataUrl:", err);
  }
  return {
    url: dataUrl,
    path: `dataUrl/${file.name}`,
    fileName: file.name,
    contentType: file.type,
  };
}

/**
 * Compress image using HTML Canvas to reduce payload size to < 200KB
 * Prevents timeout errors and backend body size limit issues.
 */
export async function compressImageFile(file: File, maxDimension = 1200, quality = 0.82): Promise<string> {
  if (file.type === "image/gif") {
    return readFileAsDataUrl(file);
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        readFileAsDataUrl(file).then(resolve);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
      const compressedDataUrl = canvas.toDataURL(mime, quality);
      resolve(compressedDataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      readFileAsDataUrl(file).then(resolve);
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) || "");
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
