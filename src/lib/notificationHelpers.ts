type NotifType = "message" | "system" | "payment" | "alert" | "info";
import { addFirebaseDoc } from "./apiClient";

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  from?: string;
}

function getUserIdFromAuth(): string | null {
  try {
    const raw = localStorage.getItem("ds_auth_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function pushUserNotification(userId: string, notif: Omit<Notif, "id" | "time" | "read">) {
  const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  void addFirebaseDoc("notifications", {
    id,
    userId,
    target: userId,
    broadcast: false,
    type: notif.type,
    title: notif.title,
    message: notif.body,
    targetName: notif.from,
    sentAt: new Date().toISOString(),
    read: false,
    status: "sent",
  }).catch(() => {});
}

interface AdminNotif {
  id: string;
  type: "deposit" | "withdrawal" | "support";
  title: string;
  body: string;
  time: string;
  read: boolean;
  userId?: string;
  amount?: number;
}

function pushAdminNotification(notif: Omit<AdminNotif, "id" | "time" | "read">) {
  const id = `adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  void addFirebaseDoc("notifications", {
    id,
    userId: notif.userId,
    target: "admin",
    broadcast: false,
    type: notif.type === "withdrawal" || notif.type === "deposit" ? "payment" : "alert",
    title: notif.title,
    message: notif.body,
    amount: notif.amount,
    sentAt: new Date().toISOString(),
    read: false,
    status: "sent",
  }).catch(() => {});
}

export function notifyAdminNewDeposit(userId: string, userName: string, amount: number) {
  pushAdminNotification({
    type: "deposit",
    title: "New Deposit Request",
    body: `${userName} submitted a deposit of $${amount.toFixed(2)} USDT. Review and approve in Transactions.`,
    userId,
    amount,
  });
}

export function maybeNotifyDepositApproved(userId: string, amount: number) {
  const targetId = userId === "user" ? (getUserIdFromAuth() ?? userId) : userId;
  pushUserNotification(targetId, {
    type: "payment",
    title: "Deposit Approved",
    body: `Your deposit of $${amount.toFixed(2)} USDT has been approved and credited to your balance.`,
  });
}

export function maybeNotifyDepositRejected(userId: string, amount: number) {
  const targetId = userId === "user" ? (getUserIdFromAuth() ?? userId) : userId;
  pushUserNotification(targetId, {
    type: "alert",
    title: "Deposit Rejected",
    body: `Your deposit request of $${amount.toFixed(2)} USDT was not approved. Please contact support if you have questions.`,
  });
}

export function maybeNotifyDepositProcessing(userId: string, amount: number) {
  const targetId = userId === "user" ? (getUserIdFromAuth() ?? userId) : userId;
  pushUserNotification(targetId, {
    type: "info",
    title: "Deposit Processing",
    body: `Your deposit of $${amount.toFixed(2)} USDT is being reviewed and will be credited once confirmed.`,
  });
}

export function maybeNotifyWithdrawalApproved(userId: string, amount: number) {
  const targetId = userId === "user" ? (getUserIdFromAuth() ?? userId) : userId;
  pushUserNotification(targetId, {
    type: "payment",
    title: "Withdrawal Approved",
    body: `Your withdrawal of $${amount.toFixed(2)} USDT has been approved and is being processed.`,
  });
}

export function maybeNotifyWithdrawalRejected(userId: string, amount: number, note?: string) {
  const targetId = userId === "user" ? (getUserIdFromAuth() ?? userId) : userId;
  const body = note
    ? `Your withdrawal request of $${amount.toFixed(2)} USDT was rejected. Reason: ${note}`
    : `Your withdrawal request of $${amount.toFixed(2)} USDT was rejected. Please contact support for details.`;
  pushUserNotification(targetId, {
    type: "alert",
    title: "Withdrawal Rejected",
    body,
  });
}

export function notifyUserReassignmentDeclined(userId: string, platformName: string, reason?: string) {
  const body = reason
    ? `Your re-assignment request for ${platformName} was declined. Reason: ${reason}`
    : `Your re-assignment request for ${platformName} was declined by the admin. You may submit a new request from your platform page.`;
  pushUserNotification(userId, {
    type: "alert",
    title: "Re-assignment Request Declined",
    body,
  });
  window.dispatchEvent(new Event("ds:data-changed"));
}

export function notifyUserTaskReassigned(userId: string, platformName: string) {
  pushUserNotification(userId, {
    type: "system",
    title: "Re-assignment Approved",
    body: `Your re-assignment request for ${platformName} was approved — your task has been reset and you can start fresh!`,
  });
  window.dispatchEvent(new Event("ds:data-changed"));
}
