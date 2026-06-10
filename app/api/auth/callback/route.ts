import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getUserInfo } from "@/app/lib/fga";
import {
  consumeOAuth,
  createSession,
  requestOrigin,
} from "@/app/lib/auth";

export const runtime = "edge";

// OAuth callback: verify state, exchange the code, require allowed === true,
// then create a local session keyed on the stable `sub`.
export async function GET(request: NextRequest) {
  const origin = await requestOrigin();
  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  const code = params.get("code");
  const state = params.get("state");

  const stashed = await consumeOAuth();

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(reason)}`);

  if (error) return fail(params.get("error_description") || error);
  if (!code || !state) return fail("missing_code_or_state");
  if (!stashed || stashed.state !== state) return fail("state_mismatch");

  let info;
  try {
    const redirectUri = `${origin}/api/auth/callback`;
    const tokens = await exchangeCode(code, redirectUri, stashed.codeVerifier);
    info = await getUserInfo(tokens.access_token);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "exchange_failed");
  }

  // Gate: only group members the provider marks `allowed` get a session.
  if (!info.allowed) return fail("not_allowed");

  await createSession({
    sub: info.sub,
    username: info.username,
    global_name: info.global_name,
    avatar: info.avatar,
    discord_id: info.discord_id,
  });

  return NextResponse.redirect(`${origin}/`);
}
