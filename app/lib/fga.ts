// Friend Group Auth client — SERVER-SIDE ONLY.
// Never import this into a Client Component: it reads AUTH_CLIENT_SECRET.
// Endpoint contracts: see .claude/skills/friend-group-auth/reference.md

const BASE = process.env.AUTH_BASE_URL ?? "https://group.nelsongx.com";
const CLIENT_ID = process.env.AUTH_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.AUTH_CLIENT_SECRET ?? "";

function requireConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "Friend Group Auth is not configured. Set AUTH_CLIENT_ID and AUTH_CLIENT_SECRET in .env.local.",
    );
  }
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type UserInfo = {
  sub: string;
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discord_id: string;
  allowed: boolean;
  in_guild: boolean;
  credits?: number;
};

export async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  requireConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch(`${BASE}/api/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(`${BASE}/api/oauth/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`userinfo failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Build the authorization URL to redirect the user to. */
export function authorizeUrl(params: {
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}): string {
  requireConfig();
  const q = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${BASE}/oauth/authorize?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// Payments (1 credit = 1 TWD, fixed across the whole server — no markup)
// ---------------------------------------------------------------------------

export type PayIntent = {
  intent_id: string;
  url: string;
  amount: number;
  status: string;
  expires_at: string;
};

export type PayVerify = {
  intent_id: string;
  status: "completed" | "cancelled" | "insufficient_funds" | "access_denied" | string;
  amount: number;
  ref: string;
  description: string | null;
  user_id: string;
  paid: boolean;
};

export async function createPayIntent(args: {
  amount: number;
  ref: string;
  redirectUri: string;
  description?: string;
  state?: string;
}): Promise<PayIntent> {
  requireConfig();
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    amount: String(args.amount),
    ref: args.ref,
    redirect_uri: args.redirectUri,
  });
  if (args.description) body.set("description", args.description);
  if (args.state) body.set("state", args.state);

  const res = await fetch(`${BASE}/api/pay/intent`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`pay intent failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function verifyPay(intentId: string): Promise<PayVerify> {
  requireConfig();
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    intent_id: intentId,
  });
  const res = await fetch(`${BASE}/api/pay/verify`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`pay verify failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Hosted JSON data store (this app's database)
// ---------------------------------------------------------------------------

type Scope = "app" | "user";

async function dataCall<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  requireConfig();
  const res = await fetch(`${BASE}/api/data/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      ...payload,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`data/${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function dataGet<T = unknown>(
  scope: Scope,
  key: string,
  userId?: string,
): Promise<{ value: T | null; found: boolean }> {
  const out = await dataCall<{ key: string; value: T | null; found: boolean }>("get", {
    scope,
    key,
    ...(userId ? { user_id: userId } : {}),
  });
  return { value: out.value, found: out.found };
}

export async function dataSet(
  scope: Scope,
  key: string,
  value: unknown,
  userId?: string,
): Promise<void> {
  await dataCall("set", {
    scope,
    key,
    value,
    ...(userId ? { user_id: userId } : {}),
  });
}

export async function dataDelete(
  scope: Scope,
  key: string,
  userId?: string,
): Promise<void> {
  await dataCall("delete", {
    scope,
    key,
    ...(userId ? { user_id: userId } : {}),
  });
}

export async function dataList<T = unknown>(
  scope: Scope,
  opts: { prefix?: string; userId?: string } = {},
): Promise<{ key: string; value: T; updated_at: string }[]> {
  const all: { key: string; value: T; updated_at: string }[] = [];
  let cursor: string | null = null;
  do {
    const page: { entries: typeof all; next_cursor: string | null } = await dataCall(
      "list",
      {
        scope,
        ...(opts.prefix ? { prefix: opts.prefix } : {}),
        ...(opts.userId ? { user_id: opts.userId } : {}),
        ...(cursor ? { cursor } : {}),
      },
    );
    all.push(...page.entries);
    cursor = page.next_cursor;
  } while (cursor);
  return all;
}
