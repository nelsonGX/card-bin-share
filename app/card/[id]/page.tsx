import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import {
  getCard,
  isUnlocked,
  canViewFree,
  listReports,
  type CardReport,
} from "@/app/lib/cards";
import { unlockCard, removeCard, reportCard } from "@/app/actions";
import CopyField from "@/app/components/CopyField";
import BrandMark from "@/app/components/BrandMark";
import { detectBrand } from "@/app/lib/cardBrand";

export const runtime = "edge";

const PAY_MESSAGES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  success: { text: "Payment confirmed — card unlocked.", tone: "ok" },
  cancelled: { text: "Payment cancelled.", tone: "warn" },
  insufficient_funds: { text: "Not enough credits to unlock this card.", tone: "warn" },
  access_denied: { text: "Payment was denied.", tone: "warn" },
  verify_failed: { text: "Could not verify the payment. No credits were charged.", tone: "warn" },
  unverified: { text: "Payment could not be confirmed.", tone: "warn" },
};

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const { id } = await params;
  const { pay } = await searchParams;
  const card = await getCard(id);
  if (!card) notFound();

  const owned = card.ownerSub === session.sub;
  const reveal = canViewFree(session.sub, card) || (await isUnlocked(session.sub, id));
  const payMsg = pay ? PAY_MESSAGES[pay] : undefined;

  const reports = await listReports(id);
  const myVerdict = reports.find((r) => r.sub === session.sub)?.verdict ?? null;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent"
      >
        <ArrowGlyph className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Back to pool
      </Link>

      {/* Hero card visual */}
      <div className="animate-fade-in-up mt-6">
        <div className="relative isolate aspect-[1.9/1] overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/15 blur-2xl" />
          <div className="flex items-start justify-between">
            <div className="h-7 w-11 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-400/80 shadow-inner" />
            {reveal ? (
              <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                ✓ Unlocked
              </span>
            ) : (
              <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                🔒 Locked
              </span>
            )}
          </div>
          <div className="mt-6 font-mono text-2xl tracking-[0.2em] drop-shadow-sm sm:text-3xl">
            •••• {card.number.slice(-4)}
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="text-xs">
              <div className="uppercase tracking-wider text-white/60">
                Shared by
              </div>
              <div className="text-sm font-medium">
                {owned ? "you" : card.ownerName}
              </div>
            </div>
            <BrandMark
              brand={detectBrand(card.number)}
              className="text-3xl text-white drop-shadow"
            />
          </div>
        </div>
      </div>

      {payMsg && (
        <p
          className={`animate-fade-in mt-6 rounded-xl border px-4 py-2.5 text-sm font-medium ${
            payMsg.tone === "ok"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300"
          }`}
        >
          {payMsg.text}
        </p>
      )}

      {reveal ? (
        <div
          className="stagger mt-6 flex flex-col gap-3"
        >
          <CopyField label="Card number" value={card.number} />
          <div className="grid grid-cols-2 gap-3">
            <CopyField label="Expiry" value={card.expiry} />
            <CopyField label="CVV" value={card.cvv} />
          </div>
          <CopyField label="Notes" value={card.notes} mono={false} />

          {owned && (
            <form action={removeCard} className="mt-3">
              <input type="hidden" name="id" value={card.id} />
              <button className="btn btn-danger h-10 px-5 text-sm">
                <TrashGlyph className="size-4" />
                Delete this card
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="surface animate-fade-in-up mt-6 rounded-2xl p-7 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
            <LockGlyph className="size-7" />
          </div>
          <p className="text-sm text-muted">This card is locked.</p>
          <p className="mb-6 mt-1 text-4xl font-semibold tracking-tight">
            {card.price}
            <span className="ml-1.5 text-base font-medium text-muted">
              credits
            </span>
          </p>
          <form action={unlockCard}>
            <input type="hidden" name="id" value={card.id} />
            <button className="btn btn-primary h-12 w-full text-[0.95rem]">
              <LockGlyph className="size-4" />
              Unlock for {card.price} credits
            </button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            1 credit = 1 TWD. Pay once — it stays unlocked for you.
          </p>
        </div>
      )}

      <ReportsPanel
        cardId={card.id}
        reports={reports}
        myVerdict={myVerdict}
        canReport={reveal}
      />
    </main>
  );
}

/* ---- Validity reports ---- */
function ReportsPanel({
  cardId,
  reports,
  myVerdict,
  canReport,
}: {
  cardId: string;
  reports: CardReport[];
  myVerdict: "valid" | "invalid" | null;
  canReport: boolean;
}) {
  const valid = reports.filter((r) => r.verdict === "valid").length;
  const invalid = reports.filter((r) => r.verdict === "invalid").length;

  return (
    <section className="surface animate-fade-in-up mt-6 rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">Does it work?</h2>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-300">
            <CheckGlyph className="size-3.5" />
            {valid}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-600 dark:text-rose-300">
            <CrossGlyph className="size-3.5" />
            {invalid}
          </span>
        </div>
      </div>

      {canReport ? (
        <form action={reportCard} className="mb-4 flex gap-3">
          <input type="hidden" name="id" value={cardId} />
          <button
            name="verdict"
            value="valid"
            className={`btn h-10 flex-1 text-sm ${
              myVerdict === "valid" ? "btn-primary" : "btn-ghost"
            }`}
          >
            <CheckGlyph className="size-4" />
            Works
          </button>
          <button
            name="verdict"
            value="invalid"
            className={`btn h-10 flex-1 text-sm ${
              myVerdict === "invalid" ? "btn-danger" : "btn-ghost"
            }`}
          >
            <CrossGlyph className="size-4" />
            Doesn&apos;t work
          </button>
        </form>
      ) : (
        <p className="mb-4 text-sm text-muted">
          Unlock this card to report whether it works.
        </p>
      )}

      {reports.length === 0 ? (
        <p className="text-sm text-muted">No reports yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reports.map((r) => (
            <li
              key={r.sub}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate font-medium">{r.name}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  r.verdict === "valid"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                }`}
              >
                {r.verdict === "valid" ? (
                  <>
                    <CheckGlyph className="size-3" />
                    Works
                  </>
                ) : (
                  <>
                    <CrossGlyph className="size-3" />
                    Doesn&apos;t work
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---- Inline icons ---- */
function ArrowGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M19 12H5m6 6-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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

function CrossGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
