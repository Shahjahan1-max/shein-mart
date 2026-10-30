// Fetch-based action client for standalone hosting (Vercel frontend +
// Render backend). Same call shape as before, so no App.tsx call site
// changes: api.listProducts(args), api.getCart(args), ...
// Each call POSTs { action, args, token } to the backend's /actions
// endpoint. The token is the login session issued at sign-in (stored in
// localStorage); it is omitted when absent, so calls from a signed-out
// visitor — and calls to an older backend that predates sessions —
// carry exactly the old { action, args } shape.
// Backend URL comes from VITE_API_URL (set it in Vercel to the Render
// service URL once the backend actions adapter is live). Until then the
// bundle still builds fine; data calls fail at runtime only.
const API_URL = import.meta.env.VITE_API_URL ?? "";

// Login-session token (opaque; the server stores only its hash).
const TOKEN_KEY = "sheinstore-session-token";
// NOTE: SESSION_KEY below must match App.tsx's SESSION_KEY.
const SESSION_KEY = "dropship-session-user";
let reloadingForAuth = false;

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode etc.) — calls just go token-less */
  }
}

export function clearSessionToken() {
  setSessionToken(null);
}

// The server rejected the session (signed out elsewhere, password reset,
// account removed): drop local state and reboot as a guest. Guarded to
// fire once per page load so concurrent failing queries can't loop.
function clearSessionAndReload() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  if (!reloadingForAuth) {
    reloadingForAuth = true;
    window.location.reload();
  }
}

// Actions that must NEVER auto-retry after a network failure: the request
// may already have executed server-side while its response was lost, and
// running one twice would duplicate an order, a payment, a message, a
// ticket, a review or a delete. Everything else (reads, idempotent sets,
// login, price refresh, ratings, visits) retries, because a Render
// free-service cold start drops the first request while the server boots —
// that is exactly the "TypeError: Failed to fetch" users see at login and
// in the Admin Panel after idle time.
const NO_RETRY_ACTIONS = new Set([
  "placeOrder", "adminQuickSendSellerOrder",
  "requestDeposit", "requestWithdraw",
  "adminCreditSeller", "adminDirectWithdraw", "adminPayWithdrawal", "sellerPayOrderFromWallet",
  "updateOrderStatus", "adminReviewShippedOrder", "adminReviewOrderPayment", "cancelBuyerOrder", "reviewWalletRequest",
  "register", "registerSeller", "convertBuyerToSeller", "reviewSeller",
  "adminDeleteAccount", "adminDeleteProduct", "adminDeleteChatThread", "adminDeleteTicket", "adminDeleteExternalProduct", "adminDeletePasswordResetRequest",
  "sendChatMessage", "adminReplyChat", "createTicket", "replyTicket", "submitReview",
]);
// Delays between retries: attempts land at 0s, 2s, 7s, 22s, 52s — covering
// a Render free-service cold start in most cases.
const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000];
const SERVER_UNREACHABLE = "Could not reach the server. It may be waking up — please try again in a moment.";

async function callAction(action: string, args: unknown): Promise<any> {
  const token = getSessionToken();
  const attempts = NO_RETRY_ACTIONS.has(action) ? 1 : 1 + RETRY_DELAYS_MS.length;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    let res: Response;
    try {
      res = await fetch(`${API_URL}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, args, token: token ?? undefined }),
      });
    } catch {
      // fetch threw before any HTTP response arrived (network down or the
      // server still booting): retry, unless this action must not run twice.
      if (attempt + 1 < attempts) continue;
      throw new Error(SERVER_UNREACHABLE);
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok) {
      // ONLY "Sign in required." (missing/invalid token) means a dead
      // session. "Not allowed." means a VALID session hit a permission
      // rule — signing the user out for that would turn a permission
      // bug into a mysterious logout (exactly what happened when the
      // Admin Panel opened a customer chat thread), so it surfaces as
      // a plain error instead.
      if (data?.error === "Sign in required.") {
        clearSessionAndReload();
      }
      throw new Error(`Action ${action} failed: ${res.status}`);
    }
    return data;
  }
  throw new Error(SERVER_UNREACHABLE);
}

type ActionFn = (args: any) => Promise<any>;

export const api: Record<string, ActionFn> = new Proxy({} as Record<string, ActionFn>, {
  get(_t, prop: string) {
    if (prop === "then") return undefined;
    return (args: any) => callAction(prop, args);
  },
});

export type ApiResponse<T, M extends keyof T> = T[M] extends (args: any) => Promise<infer R> ? R : unknown;
export type ApiRequest<T, M extends keyof T> = T[M] extends (args: infer A) => any ? A : never;
