"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSession,
  clearSession,
  requestOrigin,
} from "@/app/lib/auth";
import {
  createCard,
  deleteCard,
  getCard,
  isUnlocked,
  canViewFree,
} from "@/app/lib/cards";
import { createPayIntent } from "@/app/lib/fga";

// Accept the many ways people type a card expiry and normalize to "MM/YY".
// Handles: "8/27", "08/27", "08/2027", "0827", "082027", "08-27", "08.27",
// "08 27". Returns null only when it genuinely can't make sense of the input.
function normalizeExpiry(raw: string): string | null {
  const s = raw.trim();
  let month: number;
  let yearStr: string;

  const withSep = s.match(/^(\d{1,2})\s*[\/\-. ]\s*(\d{2}|\d{4})$/);
  if (withSep) {
    month = parseInt(withSep[1], 10);
    yearStr = withSep[2];
  } else {
    const d = s.replace(/\D/g, "");
    if (d.length === 4) {
      month = parseInt(d.slice(0, 2), 10);
      yearStr = d.slice(2);
    } else if (d.length === 6) {
      month = parseInt(d.slice(0, 2), 10);
      yearStr = d.slice(2);
    } else if (d.length === 3) {
      month = parseInt(d.slice(0, 1), 10);
      yearStr = d.slice(1);
    } else {
      return null;
    }
  }

  if (!(month >= 1 && month <= 12)) return null;
  const yy = yearStr.length === 4 ? yearStr.slice(2) : yearStr;
  if (!/^\d{2}$/.test(yy)) return null;
  return `${String(month).padStart(2, "0")}/${yy}`;
}

export async function logout() {
  await clearSession();
  redirect("/");
}

export async function addCard(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/");

  const number = String(formData.get("number") ?? "").replace(/\s+/g, "");
  const expiry = String(formData.get("expiry") ?? "").trim();
  const cvv = String(formData.get("cvv") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "0").trim();

  // Validation: credits are whole, non-negative numbers.
  const price = Math.max(0, Math.floor(Number(priceRaw) || 0));
  if (!/^\d{12,19}$/.test(number)) redirect("/?form_error=bad_number");
  // Be lenient with expiry: accept "8/27", "08/2027", "0827", "08-27", etc.
  const normalizedExpiry = normalizeExpiry(expiry);
  if (!normalizedExpiry) redirect("/?form_error=bad_expiry");
  if (!/^\d{3,4}$/.test(cvv)) redirect("/?form_error=bad_cvv");

  await createCard({
    ownerSub: session.sub,
    ownerName: session.globalName || session.username,
    number,
    expiry: normalizedExpiry,
    cvv,
    notes,
    price,
  });

  revalidatePath("/");
  redirect("/");
}

export async function removeCard(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/");

  const id = String(formData.get("id") ?? "");
  const card = await getCard(id);
  // Only the owner may delete.
  if (card && card.ownerSub === session.sub) {
    await deleteCard(id);
  }

  revalidatePath("/");
  redirect("/");
}

// Reveal a card: free for owner / price-0 cards, otherwise start a credit
// payment and send the user to the provider's pay page.
export async function unlockCard(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/");

  const id = String(formData.get("id") ?? "");
  const card = await getCard(id);
  if (!card) redirect("/");

  // Owner and free cards need no payment; already-unlocked users skip too.
  if (canViewFree(session.sub, card) || (await isUnlocked(session.sub, id))) {
    redirect(`/card/${id}`);
  }

  const origin = await requestOrigin();
  const intent = await createPayIntent({
    amount: card.price, // credits == TWD, no markup
    // ref includes price so a price change forces a fresh intent (avoids 409)
    ref: `view:${id}:${session.sub}:${card.price}`,
    redirectUri: `${origin}/pay/return`,
    description: `Unlock card •••• ${card.number.slice(-4)}`,
    state: id,
  });

  redirect(intent.url);
}
