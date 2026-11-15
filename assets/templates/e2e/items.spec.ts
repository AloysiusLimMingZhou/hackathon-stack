import { expect, test } from "@playwright/test";

// The "golden path": the exact flow you will show the judges. Keep this one green at all times.
test("signed-in user can add an item and see it in the list", async ({ page }) => {
  const title = `Demo item ${Date.now()}`;
  await page.goto("/items");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Created by Playwright");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByTestId("item-list").getByText(title)).toBeVisible();
});

test("blank title shows a validation error", async ({ page }) => {
  await page.goto("/items");
  await page.getByRole("button", { name: "Add item" }).click();
  // Not getByRole("alert"): Next's route announcer is also role="alert".
  await expect(page.getByText("Title is required")).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("visitor can browse but is asked to sign in to add", async ({ page }) => {
    await page.goto("/items");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item" })).toHaveCount(0);
  });
});
