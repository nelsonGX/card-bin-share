import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { listCardSummaries, unlockedCardIds } from "@/app/lib/cards";
import { addCard, logout } from "@/app/actions";

const AUTH_ERRORS: Record<string, string> = {
  not_allowed: "That Discord account isn't a member of the group.",
  state_mismatch: "Login session expired — please try again.",
  missing_code_or_state: "Login was interrupted — please try again.",
};

const FORM_ERRORS: Record<string, string> = {
  bad_number: "Card number must be 12–19 digits.",
  bad_expiry: "Expiry must be in MM/YY format.",
  bad_cvv: "CVV must be 3 or 4 digits.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; form_error?: string }>;
}) {
  const session = await getSession();
  const sp = await searchParams;

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Card Bin Share
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          A private pool of prepaid cards for our group. Log in with Discord to
          browse and share cards.
        </p>
        {sp.auth_error && (
          <p className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {AUTH_ERRORS[sp.auth_error] ?? sp.auth_error}
          </p>
        )}
        <a
          href="/api/auth/login"
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#5865F2] px-6 font-medium text-white transition-colors hover:bg-[#4752c4]"
        >
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Card Bin Share
          </h1>
          <p className="text-sm text-zinc-500">
            Signed in as {session.globalName || session.username}
          </p>
        </div>
        <form action={logout}>
          <button className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
            Log out
          </button>
        </form>
      </header>

      {/* Add a card */}
      <section className="mb-10 rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-medium text-black dark:text-zinc-50">
          Share a card
        </h2>
        {sp.form_error && (
          <p className="mb-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {FORM_ERRORS[sp.form_error] ?? "Please check the card details."}
          </p>
        )}
        <form action={addCard} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Card number</span>
            <input
              name="number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              required
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Expiry (MM/YY)</span>
            <input
              name="expiry"
              placeholder="08/27"
              required
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">CVV</span>
            <input
              name="cvv"
              inputMode="numeric"
              autoComplete="off"
              placeholder="123"
              required
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              View price (credits)
            </span>
            <input
              name="price"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Notes (optional)</span>
            <input
              name="notes"
              placeholder="≈ 500 TWD balance, Visa"
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300">
              Add card
            </button>
            <span className="ml-3 text-xs text-zinc-500">
              Price is in credits (1 credit = 1 TWD). Set 0 to share for free.
            </span>
          </div>
        </form>
      </section>

      {/* Card pool */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-black dark:text-zinc-50">
          Cards in the pool ({cards.length})
        </h2>
        {cards.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No cards yet — be the first to share one above.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cards.map((c) => {
              const owned = c.ownerSub === session.sub;
              const free = c.price <= 0;
              const canView = owned || free || unlocked.has(c.id);
              return (
                <li key={c.id}>
                  <Link
                    href={`/card/${c.id}`}
                    className="block rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:hover:border-white/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-lg text-black dark:text-zinc-50">
                        •••• {c.last4}
                      </span>
                      <Badge owned={owned} free={free} canView={canView} price={c.price} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
                      <span>exp {c.expiry}</span>
                      <span>by {owned ? "you" : c.ownerName}</span>
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
    "rounded-full px-2.5 py-0.5 text-xs font-medium";
  if (owned)
    return <span className={`${cls} bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300`}>Yours</span>;
  if (free)
    return <span className={`${cls} bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300`}>Free</span>;
  if (canView)
    return <span className={`${cls} bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300`}>Unlocked</span>;
  return (
    <span className={`${cls} bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300`}>
      {price} credits
    </span>
  );
}
