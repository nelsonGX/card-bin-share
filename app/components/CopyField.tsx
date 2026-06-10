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
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable (e.g. insecure context) — ignore
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-4 py-3 dark:border-white/15 dark:bg-zinc-900">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
        <div
          className={`truncate text-lg ${mono ? "font-mono" : ""} text-black dark:text-zinc-50`}
        >
          {value || <span className="text-zinc-400">—</span>}
        </div>
      </div>
      {value && (
        <button
          onClick={copy}
          className="shrink-0 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
