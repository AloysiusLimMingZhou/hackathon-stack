import { describe, expect, it } from "vitest";
import { createItemInput } from "./items";

describe("createItemInput", () => {
  it("trims and accepts a title", () => {
    expect(createItemInput.parse({ title: "  Hello  " })).toEqual({ title: "Hello" });
  });

  it("rejects a blank title", () => {
    expect(createItemInput.safeParse({ title: "   " }).success).toBe(false);
  });
});
