import { NextResponse } from "next/server";
import { authorizeUrl } from "@/app/lib/fga";
import { createPkce, stashOAuth, requestOrigin } from "@/app/lib/auth";

// Begin login: mint a PKCE pair + state, stash them, redirect to the provider.
export async function GET() {
  const { state, codeVerifier, codeChallenge } = createPkce();
  await stashOAuth({ state, codeVerifier });

  const redirectUri = `${await requestOrigin()}/api/auth/callback`;
  const url = authorizeUrl({
    redirectUri,
    scope: "identify roles",
    state,
    codeChallenge,
  });
  return NextResponse.redirect(url);
}
