import { beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers read the session from the request; fake it per test.
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock("@/lib/session", () => ({ getRequestSession: vi.fn(async () => session.current) }));

import { GET, POST } from "@/app/api/items/route";
import { createItem, listItems } from "@/server/items";

const post = (body: unknown) =>
  POST(new Request("http://test/api/items", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  session.current = { user: { id: "user-a" } };
});

describe("items service (real Postgres)", () => {
  it("creates and lists items newest first", async () => {
    await createItem({ title: "older" }, "user-a");
    await createItem({ title: "newer" }, "user-a");
    const titles = (await listItems()).map((i) => i.title);
    expect(titles).toEqual(["newer", "older"]);
  });

  it("scopes listing to an owner when asked", async () => {
    await createItem({ title: "mine" }, "user-a");
    await createItem({ title: "theirs" }, "user-b");
    expect((await listItems("user-a")).map((i) => i.title)).toEqual(["mine"]);
  });
});

describe("/api/items route handler", () => {
  it("POST creates an item owned by the session user, GET returns it", async () => {
    const res = await post({ title: "via api", ownerId: "someone-else" });
    expect(res.status).toBe(201);
    expect((await res.json()).ownerId).toBe("user-a"); // body can't choose the owner
    const list = await (await GET()).json();
    expect(list.map((i: { title: string }) => i.title)).toContain("via api");
  });

  it("POST without a session is rejected with 401", async () => {
    session.current = null;
    expect((await post({ title: "anon" })).status).toBe(401);
  });

  it("POST rejects an empty title with 400", async () => {
    expect((await post({ title: "  " })).status).toBe(400);
  });
});
