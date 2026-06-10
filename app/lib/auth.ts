// Session + OAuth/PKCE helpers. SERVER-SIDE ONLY.
// Sessions are stateless: a signed (HMAC-SHA256) JSON payload in an httpOnly
// cookie. The signing key is AUTH_SESSION_SECRET, kept server-side.
import { cookies } from "next/headers";
import crypto from "node:crypto";

const SESSION_COOKIE = "cb_session";
const OAUTH_COOKIE = "cb_oauth";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s) throw new Error("AUTH_SESSION_SECRET is not set in .env.local");
  return s;
}

// --- base64url + signing -------------------------------------------------

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Pack an object into a `payload.signature` string. */
function pack(obj: unknown): string {
  const payload = b64url(Buffer.from(JSON.stringify(obj)));
  return `${payload}.${sign(payload)}`;
}

/** Verify and unpack a `payload.signature` string; null if tampered/invalid. */
function unpack<T>(token: string | undefined): T | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
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
  const session = unpack<Session>(store.get(SESSION_COOKIE)?.value);
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
  store.set(SESSION_COOKIE, pack(session), {
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

export function createPkce(): { state: string; codeVerifier: string; codeChallenge: string } {
  const codeVerifier = b64url(crypto.randomBytes(32));
  const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = b64url(crypto.randomBytes(16));
  return { state, codeVerifier, codeChallenge };
}

export async function stashOAuth(data: OAuthState): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_COOKIE, pack(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete login
  });
}

export async function consumeOAuth(): Promise<OAuthState | null> {
  const store = await cookies();
  const data = unpack<OAuthState>(store.get(OAUTH_COOKIE)?.value);
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
