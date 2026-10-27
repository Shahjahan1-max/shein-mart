// Minimal local replacement for the @hatch/space-sdk action shell, so the
// store's action logic runs on a standalone backend (Render + Postgres)
// without the Muse hosted runtime. defineAction keeps the zod request /
// response schemas and the handler unchanged; the server validates args
// with request.parse() before calling the handler. ctx.invalidateQueries
// is a no-op here: the frontend already invalidates its own queries after
// mutations, and there is no hosted transport to push invalidations over.
import { z } from "zod";

export { z };

export type ActionDef = {
  request: any;
  response: any;
  handler: (ctx: Ctx, args: any) => Promise<any>;
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
};
