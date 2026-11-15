"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { createItemInput } from "@/lib/validation/items";
import { createItem } from "@/server/items";

export type FormState = { error?: string; ok?: boolean };

// Server actions are public HTTP endpoints: authenticate and validate here, every time.
export async function createItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createItemInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createItem(parsed.data, user.id);
  revalidatePath("/items");
  return { ok: true };
}
