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
  if (!/^\d{2}\/\d{2}$/.test(expiry)) redirect("/?form_error=bad_expiry");
  if (!/^\d{3,4}$/.test(cvv)) redirect("/?form_error=bad_cvv");

  await createCard({
    ownerSub: session.sub,
    ownerName: session.globalName || session.username,
    number,
    expiry,
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
