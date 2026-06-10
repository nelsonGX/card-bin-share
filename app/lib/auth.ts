// Session + OAuth/PKCE helpers. SERVER-SIDE ONLY.
// Sessions are stateless: a signed (HMAC-SHA256) JSON payload in an httpOnly
// cookie. The signing key is AUTH_SESSION_SECRET, kept server-side.
import { cookies } from "next/headers";

const SESSION_COOKIE = "cb_session";
const OAUTH_COOKIE = "cb_oauth";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function secret(): string {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s) throw new Error("AUTH_SESSION_SECRET is not set in .env.local");
  return s;
}

// --- base64url + signing -------------------------------------------------

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return b64url(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  if (aa.length !== bb.length) return false;

  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

/** Pack an object into a `payload.signature` string. */
async function pack(obj: unknown): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify(obj)));
  return `${payload}.${await sign(payload)}`;
}

/** Verify and unpack a `payload.signature` string; null if tampered/invalid. */
async function unpack<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(payload);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    return JSON.parse(decoder.decode(b64urlDecode(payload))) as T;
  } catch {
    return null;
  }
}

// --- session -------------------------------------------------------------

export type Session = {
  sub: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  discordId: string;
  exp: number; // unix seconds
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = await unpack<Session>(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (typeof session.exp !== "number" || session.exp * 1000 < Date.now()) return null;
  return session;
}

export async function createSession(user: {
  sub: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discord_id: string;
}): Promise<void> {
  const session: Session = {
    sub: user.sub,
    username: user.username,
    globalName: user.global_name,
    avatar: user.avatar,
    discordId: user.discord_id,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, await pack(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// --- PKCE / OAuth transaction -------------------------------------------

export type OAuthState = { state: string; codeVerifier: string };

export async function createPkce(): Promise<{
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = b64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier))),
  );
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { state, codeVerifier, codeChallenge };
}

export async function stashOAuth(data: OAuthState): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_COOKIE, await pack(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete login
  });
}

export async function consumeOAuth(): Promise<OAuthState | null> {
  const store = await cookies();
  const data = await unpack<OAuthState>(store.get(OAUTH_COOKIE)?.value);
  store.set(OAUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return data;
}

// --- request origin (to build exact-match redirect URIs) -----------------

/**
 * Build the origin (scheme://host) of the current request from headers so the
 * redirect_uri matches a registered URI in dev (localhost:5674) and prod
 * (cards.nelsongx.com) alike.
 */
export async function requestOrigin(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:5674";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
