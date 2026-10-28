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

async function callAction(action: string, args: unknown): Promise<any> {
  const token = getSessionToken();
  const res = await fetch(`${API_URL}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args, token: token ?? undefined }),
  });
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

type ActionFn = (args: any) => Promise<any>;

export const api: Record<string, ActionFn> = new Proxy({} as Record<string, ActionFn>, {
  get(_t, prop: string) {
    if (prop === "then") return undefined;
    return (args: any) => callAction(prop, args);
  },
});

export type ApiResponse<T, M extends keyof T> = T[M] extends (args: any) => Promise<infer R> ? R : unknown;
export type ApiRequest<T, M extends keyof T> = T[M] extends (args: infer A) => any ? A : never;
