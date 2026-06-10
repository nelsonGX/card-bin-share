import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { listCardSummaries, unlockedCardIds } from "@/app/lib/cards";
import { addCard, logout } from "@/app/actions";
import BrandMark from "@/app/components/BrandMark";
import CardNumberInput from "@/app/components/CardNumberInput";

const AUTH_ERRORS: Record<string, string> = {
  not_allowed: "That Discord account isn't a member of the group.",
  state_mismatch: "Login session expired — please try again.",
  missing_code_or_state: "Login was interrupted — please try again.",
};

const FORM_ERRORS: Record<string, string> = {
  bad_number: "That card number doesn't look right — it should be 12–19 digits.",
  bad_expiry: "Couldn't read that expiry date. Try something like 08/27.",
  bad_cvv: "The CVV should be the 3 or 4 digits on the back of the card.",
};

// Deterministic gradient per card so each tile feels distinct but stable.
const GRADIENTS = [
  "from-indigo-500 via-violet-500 to-purple-600",
  "from-sky-500 via-blue-500 to-indigo-600",
  "from-emerald-500 via-teal-500 to-cyan-600",
  "from-rose-500 via-pink-500 to-fuchsia-600",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-fuchsia-500 via-purple-500 to-indigo-600",
];

function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; form_error?: string }>;
}) {
  const session = await getSession();
  const sp = await searchParams;

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <div className="animate-pop-in flex flex-col items-center gap-6">
          <div className="grid size-20 place-items-center rounded-2xl bg-white p-2.5 shadow-lg ring-1 ring-black/5 transition-transform duration-300 hover:scale-105 hover:-rotate-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/card_bin.webp"
              alt="Card Bin Share"
              width={80}
              height={80}
              className="size-full object-contain"
            />
          </div>
          <div className="space-y-3">
            <h1 className="text-balance text-4xl font-semibold tracking-tight">
              Card Bin Share
            </h1>
            <p className="mx-auto max-w-md text-pretty text-muted">
              A private pool of prepaid cards for our group. Log in with Discord
              to browse and share cards.
            </p>
          </div>
        </div>

        {sp.auth_error && (
          <p className="animate-fade-in rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-300">
            {AUTH_ERRORS[sp.auth_error] ?? sp.auth_error}
          </p>
        )}

        <a
          href="/api/auth/login"
          className="btn btn-discord animate-fade-in-up h-12 px-7 text-[0.95rem]"
          style={{ animationDelay: "0.15s" }}
        >
          <DiscordGlyph className="size-5" />
          Log in with Discord
        </a>
      </main>
    );
  }

  const [cards, unlocked] = await Promise.all([
    listCardSummaries(),
    unlockedCardIds(session.sub),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-6 sm:py-12">
      <header className="animate-fade-in-up mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-md ring-1 ring-black/5 transition-transform duration-200 hover:-rotate-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/card_bin.webp"
              alt="Card Bin Share"
              width={44}
              height={44}
              className="size-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Card Bin Share
            </h1>
            <p className="text-sm text-muted">
              Signed in as{" "}
              <span className="font-medium text-foreground">
                {session.globalName || session.username}
              </span>
            </p>
          </div>
        </div>
        <form action={logout}>
          <button className="btn btn-ghost h-9 px-4 text-sm">Log out</button>
        </form>
      </header>

      {/* Add a card */}
      <section
        className="surface animate-fade-in-up mb-12 rounded-2xl p-6"
        style={{ animationDelay: "0.06s" }}
      >
        <div className="mb-5 flex items-center gap-2">
          <PlusGlyph className="size-5 text-accent" />
          <h2 className="text-lg font-semibold tracking-tight">Share a card</h2>
        </div>

        {sp.form_error && (
          <p className="animate-fade-in mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:text-red-300">
            {FORM_ERRORS[sp.form_error] ?? "Please check the card details."}
          </p>
        )}

        <form action={addCard} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium text-muted">Card number</span>
            <CardNumberInput />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted">Expiry</span>
            <input
              name="expiry"
              placeholder="08/27"
              required
              className="field font-mono tracking-wide"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted">CVV</span>
            <input
              name="cvv"
              inputMode="numeric"
              autoComplete="off"
              placeholder="123"
              required
              className="field font-mono tracking-wide"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted">View price (credits)</span>
            <input
              name="price"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              className="field"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted">Notes (optional)</span>
            <input
              name="notes"
              placeholder="≈ 500 TWD balance, Visa"
              className="field"
            />
          </label>
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <button className="btn btn-primary h-11 px-6 text-sm">
              <PlusGlyph className="size-4" />
              Add card
            </button>
            <span className="text-xs leading-relaxed text-muted">
              Price is in credits (1 credit = 1 TWD). Set 0 to share for free.
            </span>
          </div>
        </form>
      </section>

      {/* Card pool */}
      <section
        className="animate-fade-in-up"
        style={{ animationDelay: "0.12s" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Cards in the pool
          </h2>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-accent">
            {cards.length}
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="surface rounded-2xl px-6 py-14 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
              <CardGlyph className="size-6" />
            </div>
            <p className="text-sm text-muted">
              No cards yet — be the first to share one above.
            </p>
          </div>
        ) : (
          <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.map((c) => {
              const owned = c.ownerSub === session.sub;
              const free = c.price <= 0;
              const canView = owned || free || unlocked.has(c.id);
              return (
                <li key={c.id}>
                  <Link
                    href={`/card/${c.id}`}
                    className="lift group block overflow-hidden rounded-2xl"
                  >
                    {/* Mini credit-card visual */}
                    <div
                      className={`relative isolate aspect-[1.9/1] bg-gradient-to-br ${gradientFor(
                        c.id
                      )} p-4 text-white`}
                    >
                      <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/15 blur-xl" />
                      <div className="flex items-start justify-between">
                        <div className="h-6 w-9 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-400/80 shadow-inner" />
                        <Badge
                          owned={owned}
                          free={free}
                          canView={canView}
                          price={c.price}
                        />
                      </div>
                      <div className="mt-5 flex items-center gap-2 font-mono text-xl tracking-[0.2em] drop-shadow-sm sm:text-2xl">
                        •••• {c.last4}
                      </div>
                      <div className="mt-3 flex items-end justify-between text-xs">
                        <div>
                          <div className="uppercase tracking-wider text-white/60">
                            Expires
                          </div>
                          <div className="font-mono text-sm">{c.expiry}</div>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <div>
                            <div className="uppercase tracking-wider text-white/60">
                              Shared by
                            </div>
                            <div className="max-w-[6.5rem] truncate text-sm font-medium">
                              {owned ? "you" : c.ownerName}
                            </div>
                          </div>
                          <BrandMark
                            brand={c.brand}
                            className="text-2xl text-white drop-shadow"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Footer hint */}
                    <div className="surface flex items-center justify-between rounded-b-2xl border-t-0 px-4 py-2.5 text-sm">
                      <span className="text-muted">
                        {canView ? "Tap to view details" : "Tap to unlock"}
                      </span>
                      <ArrowGlyph className="size-4 text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Badge({
  owned,
  free,
  canView,
  price,
}: {
  owned: boolean;
  free: boolean;
  canView: boolean;
  price: number;
}) {
  const cls =
    "rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm";
  if (owned)
    return <span className={`${cls} bg-white/25 text-white`}>Yours</span>;
  if (free)
    return <span className={`${cls} bg-white/25 text-white`}>Free</span>;
  if (canView)
    return (
      <span className={`${cls} bg-white/25 text-white`}>✓ Unlocked</span>
    );
  return (
    <span className={`${cls} bg-black/30 text-white`}>🔒 {price} credits</span>
  );
}

/* ---- Inline icons (no extra deps) ---- */
function CardGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="2.5"
        y="5"
        width="19"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6 15.5h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiscordGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.21.375-.42.825-.57 1.207a18.27 18.27 0 0 0-5.63 0C9.54 3.825 9.315 3.375 9.12 3a19.7 19.7 0 0 0-4.432 1.369C1.876 8.59 1.114 12.7 1.49 16.756a19.9 19.9 0 0 0 6.073 3.057c.493-.668.93-1.377 1.305-2.124-.72-.27-1.41-.604-2.063-.999.174-.127.343-.26.504-.396a14.2 14.2 0 0 0 12.18 0c.165.142.334.275.504.396-.654.396-1.347.73-2.067 1 .375.746.81 1.455 1.305 2.123a19.84 19.84 0 0 0 6.073-3.057c.444-4.703-.764-8.776-3.197-12.387ZM8.02 14.331c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.95-2.42 2.156-2.42 1.21 0 2.18 1.096 2.157 2.42 0 1.334-.95 2.42-2.157 2.42Zm7.974 0c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.95-2.42 2.156-2.42 1.21 0 2.18 1.096 2.157 2.42 0 1.334-.946 2.42-2.157 2.42Z" />
    </svg>
  );
}
