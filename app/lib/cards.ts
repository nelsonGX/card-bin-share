// Card model on top of the Friend Group Auth hosted JSON store.
//   - app scope, key `card:<id>`            → the full card record (shared catalog)
//   - app scope, key `report:<id>:<sub>`    → one user's valid/invalid verdict
//   - user scope, key `unlock:<id>`         → marker that this user has paid to view
// SERVER-SIDE ONLY (imports the secret-bearing fga client).
import { dataGet, dataSet, dataDelete, dataList } from "./fga";
import { detectBrand, type CardBrand } from "./cardBrand";

export type Card = {
  id: string;
  ownerSub: string;
  ownerName: string;
  number: string; // digits only
  expiry: string; // MM/YY
  cvv: string;
  notes: string;
  price: number; // credits (1 credit = 1 TWD); 0 = free
  createdAt: number;
};

// What is safe to show before unlocking: never the number/cvv/notes.
export type CardSummary = {
  id: string;
  ownerSub: string;
  ownerName: string;
  last4: string;
  brand: CardBrand; // derived from the number server-side; safe to expose
  expiry: string;
  price: number;
  createdAt: number;
};

// A viewer's report on whether a card still works.
export type Verdict = "valid" | "invalid";

export type CardReport = {
  cardId: string;
  sub: string;
  name: string;
  verdict: Verdict;
  at: number;
};

const CARD_PREFIX = "card:";
const unlockKey = (cardId: string) => `unlock:${cardId}`;
const reportPrefix = (cardId: string) => `report:${cardId}:`;
const reportKey = (cardId: string, sub: string) => `${reportPrefix(cardId)}${sub}`;

function toSummary(c: Card): CardSummary {
  return {
    id: c.id,
    ownerSub: c.ownerSub,
    ownerName: c.ownerName,
    last4: c.number.slice(-4),
    brand: detectBrand(c.number),
    expiry: c.expiry,
    price: c.price,
    createdAt: c.createdAt,
  };
}

export async function listCardSummaries(): Promise<CardSummary[]> {
  const entries = await dataList<Card>("app", { prefix: CARD_PREFIX });
  return entries
    .map((e) => toSummary(e.value))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCard(id: string): Promise<Card | null> {
  const { value, found } = await dataGet<Card>("app", `${CARD_PREFIX}${id}`);
  return found ? value : null;
}

export async function createCard(input: {
  ownerSub: string;
  ownerName: string;
  number: string;
  expiry: string;
  cvv: string;
  notes: string;
  price: number;
}): Promise<Card> {
  const card: Card = {
    id: crypto.randomUUID(),
    ownerSub: input.ownerSub,
    ownerName: input.ownerName,
    number: input.number,
    expiry: input.expiry,
    cvv: input.cvv,
    notes: input.notes,
    price: input.price,
    createdAt: Date.now(),
  };
  await dataSet("app", `${CARD_PREFIX}${card.id}`, card);
  return card;
}

export async function deleteCard(id: string): Promise<void> {
  // Remove the card and any validity reports left behind for it.
  const reports = await dataList("app", { prefix: reportPrefix(id) });
  await Promise.all([
    dataDelete("app", `${CARD_PREFIX}${id}`),
    ...reports.map((r) => dataDelete("app", r.key)),
  ]);
}

/** Record (or overwrite) this user's verdict on whether a card still works. */
export async function setReport(
  cardId: string,
  sub: string,
  name: string,
  verdict: Verdict,
): Promise<void> {
  const report: CardReport = { cardId, sub, name, verdict, at: Date.now() };
  await dataSet("app", reportKey(cardId, sub), report);
}

/** All reports for a card, newest first. */
export async function listReports(cardId: string): Promise<CardReport[]> {
  const entries = await dataList<CardReport>("app", { prefix: reportPrefix(cardId) });
  return entries.map((e) => e.value).sort((a, b) => b.at - a.at);
}

export async function isUnlocked(sub: string, cardId: string): Promise<boolean> {
  const { found } = await dataGet("user", unlockKey(cardId), sub);
  return found;
}

export async function grantUnlock(sub: string, cardId: string): Promise<void> {
  await dataSet("user", unlockKey(cardId), { at: Date.now() }, sub);
}

/** Set of card ids this user can already view (paid + free are handled at read time). */
export async function unlockedCardIds(sub: string): Promise<Set<string>> {
  const entries = await dataList("user", { prefix: "unlock:", userId: sub });
  return new Set(entries.map((e) => e.key.slice("unlock:".length)));
}

/** Whether `sub` may see full details of `card` right now (no payment needed). */
export function canViewFree(sub: string, card: Card): boolean {
  return card.ownerSub === sub || card.price <= 0;
}
