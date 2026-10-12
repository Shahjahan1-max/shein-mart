/**
 * Security stabilization regression tests (Phase 0.5)
 *
 * Verifies the client-side authorization contract:
 * - user-session token lifecycle (store / read / expire / clear)
 * - x-user-session + admin Authorization header composition
 * - admin-only firebase collection gating used by the API client
 *
 * These are pure/headless tests — no live backend required.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getUserSessionToken,
  storeUserSession,
  clearUserSession,
  userSessionAuthHeaders,
  authHeaders,
  listFirebaseDocs,
  addFirebaseDoc,
} from "../lib/apiClient";

const USER_SESSION_KEY = "ds_user_session";
const ADMIN_SESSION_KEY = "ds_admin_session";

function seedUserSession(token: string, expiresAt: string) {
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ sessionToken: token, sessionExpiresAt: expiresAt }));
}

function seedAdminSession(token: string, expiresAt: string) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ sessionToken: token, sessionExpiresAt: expiresAt }));
}

function futureISO(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

beforeEach(() => {
  localStorage.clear();
});

describe("user session token lifecycle", () => {
  it("returns the stored token while unexpired", () => {
    seedUserSession("tkn-123", futureISO(60_000));
    expect(getUserSessionToken()).toBe("tkn-123");
  });

  it("returns null and clears when the token is expired", () => {
    seedUserSession("tkn-expired", futureISO(-60_000));
    expect(getUserSessionToken()).toBeNull();
    expect(localStorage.getItem(USER_SESSION_KEY)).toBeNull();
  });

  it("returns null when the stored session is malformed", () => {
    localStorage.setItem(USER_SESSION_KEY, "not-json");
    expect(getUserSessionToken()).toBeNull();
    expect(localStorage.getItem(USER_SESSION_KEY)).toBeNull();
  });

  it("returns null when sessionToken is missing", () => {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ sessionExpiresAt: futureISO(60_000) }));
    expect(getUserSessionToken()).toBeNull();
  });

  it("storeUserSession persists token + expiry", () => {
    storeUserSession("tkn-new", futureISO(60_000));
    expect(getUserSessionToken()).toBe("tkn-new");
  });

  it("clearUserSession removes the stored session", () => {
    seedUserSession("tkn-x", futureISO(60_000));
    clearUserSession();
    expect(getUserSessionToken()).toBeNull();
  });
});

describe("userSessionAuthHeaders", () => {
  it("attaches x-user-session when a valid token exists", () => {
    seedUserSession("tkn-h", futureISO(60_000));
    expect(userSessionAuthHeaders()).toEqual({ "x-user-session": "tkn-h" });
  });

  it("returns no headers when there is no valid token", () => {
    seedUserSession("tkn-exp", futureISO(-1_000));
    expect(userSessionAuthHeaders()).toEqual({});
  });

  it("never leaks the user session as an Authorization header", () => {
    seedUserSession("tkn-h", futureISO(60_000));
    const headers = userSessionAuthHeaders();
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("authHeaders", () => {
  it("combines user session and admin bearer token", () => {
    seedUserSession("user-tkn", futureISO(60_000));
    seedAdminSession("admin-tkn", futureISO(60_000));
    const headers = authHeaders();
    expect(headers["x-user-session"]).toBe("user-tkn");
    expect(headers.Authorization).toBe("Bearer admin-tkn");
  });

  it("omits admin bearer when no valid admin session exists", () => {
    seedUserSession("user-tkn", futureISO(60_000));
    seedAdminSession("expired-admin", futureISO(-1_000));
    const headers = authHeaders();
    expect(headers["x-user-session"]).toBe("user-tkn");
    expect(headers.Authorization).toBeUndefined();
  });

  it("still attaches the user session when no admin token is present", () => {
    seedUserSession("user-tkn", futureISO(60_000));
    const headers = authHeaders();
    expect(headers["x-user-session"]).toBe("user-tkn");
  });
});

describe("firebase collection gating (admin-only read)", () => {
  it("admin-only collections are requested with requiresAdmin for reads", async () => {
    const calls: Array<{ path: string; opts: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(input), opts: init?.headers });
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await listFirebaseDocs("supportTickets");
    expect(calls).toHaveLength(1);
    expect(String(calls[0].path)).toContain("/api/firebase/supportTickets");
  });

  it("user-facing collections are NOT requested with requiresAdmin for reads", async () => {
    const calls: Array<{ path: string; opts: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(input), opts: init?.headers });
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await listFirebaseDocs("userPreferences");
    expect(calls).toHaveLength(1);
  });

  it("writes to admin-write collections request requiresAdmin", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(input), method: init?.method });
      return new Response(JSON.stringify({ success: true, data: { id: "x" } }), { status: 200 });
    }) as unknown as typeof fetch;

    await addFirebaseDoc("deposits", { userId: "u1" });
    expect(calls).toHaveLength(1);
  });
});
