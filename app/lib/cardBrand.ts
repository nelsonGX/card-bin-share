// Card network detection from a card number (BIN/IIN ranges).
// Pure & dependency-free so it is safe to import from both server and client.

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "diners"
  | "jcb"
  | "unionpay"
  | "maestro"
  | "unknown";

export const BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  maestro: "Maestro",
  unknown: "Card",
};

// Returns the network for a (partial) card number. Works on as few as the first
// 1–6 digits so it can drive a live indicator while the user types.
export function detectBrand(numberRaw: string): CardBrand {
  const n = (numberRaw || "").replace(/\D/g, "");
  if (!n) return "unknown";

  // Visa — starts with 4
  if (/^4/.test(n)) return "visa";

  // American Express — 34, 37
  if (/^3[47]/.test(n)) return "amex";

  // Mastercard — 51–55 or 2221–2720
  if (/^5[1-5]/.test(n)) return "mastercard";
  if (/^2/.test(n)) {
    const p4 = parseInt(n.slice(0, 4).padEnd(4, "0"), 10);
    if (p4 >= 2221 && p4 <= 2720) return "mastercard";
  }

  // Diners Club — 300–305, 3095, 36, 38, 39
  if (/^3(0[0-5]|095|6|8|9)/.test(n)) return "diners";

  // JCB — 3528–3589
  if (/^35/.test(n)) {
    const p4 = parseInt(n.slice(0, 4).padEnd(4, "0"), 10);
    if (p4 >= 3528 && p4 <= 3589) return "jcb";
  }

  // Discover — 6011, 644–649, 65, 622126–622925 (checked before UnionPay's 62)
  if (/^6011/.test(n) || /^65/.test(n) || /^64[4-9]/.test(n)) return "discover";
  if (/^622/.test(n)) {
    const p6 = parseInt(n.slice(0, 6).padEnd(6, "0"), 10);
    if (p6 >= 622126 && p6 <= 622925) return "discover";
  }

  // UnionPay — 62
  if (/^62/.test(n)) return "unionpay";

  // Maestro — common ranges, then broad 50 / 56–69 fallback
  if (/^(5018|5020|5038|5893|6304|6759|676[1-3]|0604)/.test(n)) return "maestro";
  if (/^5[06-9]/.test(n) || /^6/.test(n)) return "maestro";

  return "unknown";
}
