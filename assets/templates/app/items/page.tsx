import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { listItems } from "@/server/items";
import { ItemForm } from "./item-form";

// cacheComponents is on: anything that reads the DB or the session must be dynamic and inside
// <Suspense>, otherwise `next build` tries to prerender it and connects to the DB at build time.
async function ItemList() {
  await connection();
  const items = await listItems();
  if (items.length === 0) return <p className="text-muted-foreground">No items yet.</p>;
  return (
    <ul className="space-y-2" data-testid="item-list">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border p-3">
          <p className="font-medium">{item.title}</p>
          {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}

async function NewItem() {
  const session = await getSession();
  if (!session) {
    return (
      <p>
        <Link href="/sign-in" className="font-medium underline">Sign in</Link> to add items.
      </p>
    );
  }
  return <ItemForm />;
}

export default function ItemsPage() {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Items</h1>
      <Suspense fallback={null}>
        <NewItem />
      </Suspense>
      <Suspense fallback={<p>Loading…</p>}>
        <ItemList />
      </Suspense>
    </main>
  );
}
