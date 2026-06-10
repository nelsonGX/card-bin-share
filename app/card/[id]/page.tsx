import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { getCard, isUnlocked, canViewFree } from "@/app/lib/cards";
import { unlockCard, removeCard } from "@/app/actions";
import CopyField from "@/app/components/CopyField";

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

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Back to pool
      </Link>

      <h1 className="mt-4 mb-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Card •••• {card.number.slice(-4)}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        Shared by {owned ? "you" : card.ownerName}
      </p>

      {payMsg && (
        <p
          className={`mb-6 rounded-md px-4 py-2 text-sm ${
            payMsg.tone === "ok"
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {payMsg.text}
        </p>
      )}

      {reveal ? (
        <div className="flex flex-col gap-3">
          <CopyField label="Card number" value={card.number} />
          <div className="grid grid-cols-2 gap-3">
            <CopyField label="Expiry" value={card.expiry} />
            <CopyField label="CVV" value={card.cvv} />
          </div>
          <CopyField label="Notes" value={card.notes} mono={false} />

          {owned && (
            <form action={removeCard} className="mt-4">
              <input type="hidden" name="id" value={card.id} />
              <button className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
                Delete this card
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-black/10 bg-white p-6 text-center dark:border-white/15 dark:bg-zinc-900">
          <p className="mb-1 text-zinc-600 dark:text-zinc-400">
            This card is locked.
          </p>
          <p className="mb-5 text-3xl font-semibold text-black dark:text-zinc-50">
            {card.price} credits
          </p>
          <form action={unlockCard}>
            <input type="hidden" name="id" value={card.id} />
            <button className="w-full rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300">
              Unlock for {card.price} credits
            </button>
          </form>
          <p className="mt-3 text-xs text-zinc-500">
            1 credit = 1 TWD. Pay once — it stays unlocked for you.
          </p>
        </div>
      )}
    </main>
  );
}
