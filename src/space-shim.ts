// Minimal local replacement for the @hatch/space-sdk action shell, so the
// store's action logic runs on a standalone backend (Render + Postgres)
// without the Muse hosted runtime. defineAction keeps the zod request /
// response schemas and the handler unchanged; the server validates args
// with request.parse() before calling the handler. ctx.invalidateQueries
// is a no-op here: the frontend already invalidates its own queries after
// mutations, and there is no hosted transport to push invalidations over.
import { z } from "zod";

export { z };

// Login-session policy, enforced by the server dispatcher BEFORE the
// handler runs (a handler's own role/ownership checks stay as a second
// layer, they are never the only layer):
//   "public"            — no token needed (genuinely public reads, account
//                         creation, login itself, and the idempotent
//                         setup actions the app calls on every load).
//   { any: true }       — any valid token (refreshMySession, logout).
//   { admin: true }     — any valid ADMIN token (no id arg to match).
//   { arg: "<field>" }  — token's user id must equal args[field]; the
//                         handler's own checks (role, attribution) still
//                         apply on top.
//   { arg: "<field>", adminOk: true } — as above, except a valid ADMIN
//                         token bypasses the match: the Admin legitimately
//                         reads customer threads (listChatMessages from
//                         the Admin Panel). Without this, opening a thread
//                         as Admin fails the guard — and the client treats
//                         the failure as a dead session and signs out.
//   { arg: "<field>", role: "<role>" } — as above, plus token user's
//                         role must equal role (admin actions).
//   { optional: "<field>" } — if args[field] is null/undefined the call
//                         is public (guest tickets); otherwise it behaves
//                         like { arg: "<field>" }.
// An action WITHOUT an auth field is rejected by the dispatcher
// (fail-closed): every action must be tagged deliberately.
export type AuthPolicy =
  | "public"
  | { any: true }
  | { admin: true }
  | { arg: string; role?: string; adminOk?: boolean }
  | { optional: string };

export type ActionDef = {
  request: any;
  response: any;
  handler: (ctx: Ctx, args: any) => Promise<any>;
  auth?: AuthPolicy;
};

export type ActionsModule = Record<string, ActionDef>;

export function defineAction<T extends ActionDef>(def: T): T {
  return def;
}

export type BlobStore = {
  put: (key: string, bytes: Uint8Array, opts: { contentType: string }) => Promise<void>;
  getUrl: (key: string) => Promise<string>;
};

export type Ctx = {
  db: <T>() => any;
  blobs: BlobStore;
  invalidateQueries: () => void;
  // Set per request by the dispatcher when a token was validated; null
  // for public calls. Handlers must never trust id args over this.
  auth?: { userId: number; role: string; tokenHash: string } | null;
};
