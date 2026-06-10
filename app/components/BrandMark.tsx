import type { CardBrand } from "@/app/lib/cardBrand";
import { BRAND_LABELS } from "@/app/lib/cardBrand";

// Recognizable network mark. Sizes with the surrounding font-size (logos use
// 1em height), so pass a text-* class to scale it. Pure/presentational — safe
// in both server and client components.
export default function BrandMark({
  brand,
  className = "",
}: {
  brand: CardBrand;
  className?: string;
}) {
  const base = `inline-flex items-center leading-none select-none ${className}`;
  const svgStyle = { height: "1em", width: "auto" } as const;

  switch (brand) {
    case "mastercard":
      return (
        <span className={base} aria-label="Mastercard" title="Mastercard">
          <svg viewBox="0 0 38 24" style={svgStyle} aria-hidden>
            <circle cx="15" cy="12" r="11" fill="#EB001B" />
            <circle cx="23" cy="12" r="11" fill="#F79E1B" />
            <path
              d="M19 2.5a11 11 0 0 1 0 19 11 11 0 0 0 0-19Z"
              fill="#FF5F00"
            />
          </svg>
        </span>
      );

    case "visa":
      return (
        <span
          className={`${base} font-extrabold italic tracking-wider`}
          aria-label="Visa"
          title="Visa"
        >
          VISA
        </span>
      );

    case "amex":
      return (
        <span
          className={`${base} font-bold tracking-tight`}
          aria-label="American Express"
          title="American Express"
        >
          AMEX
        </span>
      );

    case "unknown":
      return null;

    default:
      // Discover / Diners / JCB / UnionPay / Maestro — clean uppercase wordmark.
      return (
        <span
          className={`${base} text-[0.75em] font-bold uppercase tracking-wider`}
          aria-label={BRAND_LABELS[brand]}
          title={BRAND_LABELS[brand]}
        >
          {BRAND_LABELS[brand]}
        </span>
      );
  }
}
