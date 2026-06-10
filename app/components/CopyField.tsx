"use client";

import { useState } from "react";

// Shows a labelled value with a copy button. Used on the reveal page so the
// borrower can grab the number / cvv without hand-typing.
export default function CopyField({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable (e.g. insecure context) — ignore
    }
  }

  return (
    <div className="surface group flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:border-[var(--accent)]">
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">
          {label}
        </div>
        <div
          className={`truncate text-lg ${mono ? "font-mono tracking-wide" : ""}`}
        >
          {value || <span className="text-muted/60">—</span>}
        </div>
      </div>
      {value && (
        <button
          onClick={copy}
          aria-label={copied ? "Copied" : `Copy ${label}`}
          className={`btn shrink-0 h-9 px-3.5 text-sm ${
            copied ? "btn-primary" : "btn-ghost"
          }`}
        >
          {copied ? (
            <span className="animate-check inline-flex items-center gap-1.5">
              <CheckGlyph className="size-4" />
              Copied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CopyGlyph className="size-4" />
              Copy
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function CopyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15V6a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
