// Route handler = public JSON API (for webhooks, mobile clients, other teams, AI tools).
// UI mutations should prefer server actions (see app/items/actions.ts).
// Note: do NOT add `export const runtime = ...` — it is rejected when cacheComponents is on,
// and route handlers already run on Node.js.
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/lib/session";
import { createItem, listItems } from "@/server/items";

export async function GET() {
  return NextResponse.json(await listItems());
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const item = await createItem(await request.json(), session.user.id); // owner from the session, never the body
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    throw err;
  }
}
