// Fetch-based action client for standalone hosting (Vercel frontend +
// Render backend). Same call shape as before, so no App.tsx call site
// changes: api.listProducts(args), api.getCart(args), ...
// Each call POSTs { action, args } to the backend's /actions endpoint.
// Backend URL comes from VITE_API_URL (set it in Vercel to the Render
// service URL once the backend actions adapter is live). Until then the
// bundle still builds fine; data calls fail at runtime only.
const API_URL = import.meta.env.VITE_API_URL ?? "";

async function callAction(action: string, args: unknown): Promise<any> {
  const res = await fetch(`${API_URL}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  if (!res.ok) {
    throw new Error(`Action ${action} failed: ${res.status}`);
  }
  return res.json();
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
