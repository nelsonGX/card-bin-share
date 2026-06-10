"use client";

import { useState } from "react";
import { detectBrand, BRAND_LABELS } from "@/app/lib/cardBrand";
import BrandMark from "./BrandMark";

// Card-number field with a live network detector. Formats digits into 4-groups
// for readability; the server action strips spaces before validating/storing.
export default function CardNumberInput() {
  const [value, setValue] = useState("");
  const brand = detectBrand(value);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 19);
    const grouped = digits.replace(/(.{4})/g, "$1 ").trim();
    setValue(grouped);
  }

  return (
    <div className="relative">
      <input
        name="number"
        value={value}
        onChange={onChange}
        inputMode="numeric"
        autoComplete="off"
        placeholder="4242 4242 4242 4242"
        required
        className="field pr-24 font-mono tracking-wide"
      />
      <span
        key={brand}
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-300 ${
          brand === "unknown"
            ? "scale-90 opacity-0"
            : "animate-pop-in opacity-100"
        }`}
        title={BRAND_LABELS[brand]}
      >
        <BrandMark brand={brand} className="text-xl text-foreground" />
      </span>
    </div>
  );
}
