import "server-only";
import { getDb } from "@/db/data-source";
import { Item } from "@/db/entities";
import { createItemInput, type CreateItemInput } from "@/lib/validation/items";

// Service layer: the only place that talks to TypeORM. Server actions, route handlers and
// server components call these functions; integration tests exercise them against real Postgres.

export async function listItems(ownerId?: string) {
  const db = await getDb();
  return db.getRepository(Item).find({
    where: ownerId ? { ownerId } : {},
    order: { createdAt: "DESC" },
  });
}

/** `ownerId` must come from the session (requireUser / getRequestSession), never from client input. */
export async function createItem(input: CreateItemInput, ownerId: string) {
  const data = createItemInput.parse(input);
  const db = await getDb();
  return db.getRepository(Item).save({ ...data, description: data.description ?? null, ownerId });
}
