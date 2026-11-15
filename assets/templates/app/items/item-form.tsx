"use client";
import { useActionState } from "react";
import { createItemAction, type FormState } from "./actions";

// Swap the raw elements for shadcn <Input>/<Button> once `npx shadcn@latest add input button` has run.
export function ItemForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createItemAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="title" className="text-sm font-medium">Title</label>
      <input id="title" name="title" className="rounded-md border px-3 py-2" />
      <label htmlFor="description" className="text-sm font-medium">Description</label>
      <textarea id="description" name="description" className="rounded-md border px-3 py-2" />
      <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Add item"}
      </button>
      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
