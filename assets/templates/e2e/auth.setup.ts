import { expect, test as setup } from "@playwright/test";

// Sign up one user per run and save the cookies; specs in the "chromium" project reuse them.
// (Better Auth rate-limits sign-ups in production mode, so don't sign up in every test.)
export const STORAGE_STATE = "e2e/.auth/user.json";

setup("sign up a demo user", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "No account? Sign up" }).click();
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/items$/);
  await page.context().storageState({ path: STORAGE_STATE });
});
