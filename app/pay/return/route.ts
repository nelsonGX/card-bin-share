import { NextRequest, NextResponse } from "next/server";
import { verifyPay } from "@/app/lib/fga";
import { getSession, requestOrigin } from "@/app/lib/auth";
import { grantUnlock } from "@/app/lib/cards";

// Return from the provider's pay page. Re-verify server-side; only grant the
// unlock when paid === true and the payer matches the logged-in user.
export async function GET(request: NextRequest) {
  const origin = await requestOrigin();
  const p = request.nextUrl.searchParams;
  const cardId = p.get("state") ?? "";
  const intentId = p.get("intent_id") ?? "";
  const status = p.get("status") ?? "";

  const session = await getSession();
  if (!session) return NextResponse.redirect(`${origin}/`);

  const back = (result: string) =>
    NextResponse.redirect(`${origin}/card/${cardId}?pay=${encodeURIComponent(result)}`);

  if (!cardId || !intentId) return NextResponse.redirect(`${origin}/`);
  if (status !== "completed") return back(status || "cancelled");

  try {
    const v = await verifyPay(intentId);
    if (v.paid && v.user_id === session.sub) {
      await grantUnlock(session.sub, cardId);
      return back("success");
    }
    return back(v.status || "unverified");
  } catch {
    return back("verify_failed");
  }
}
