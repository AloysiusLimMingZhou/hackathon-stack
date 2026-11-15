# Testing: Vitest (unit + integration) and Playwright (E2E)

At a hackathon, tests exist so you can change things at hour 20 without breaking the demo.
Aim for a few high-value tests per feature, not coverage numbers.

## The three layers

| Layer | Command | Location | What it covers | DB |
|---|---|---|---|---|
| Unit | `npm run test` | `src/**/*.test.ts(x)` next to the code | zod schemas, pure helpers, scoring/ranking logic, small client components | none |
| Integration | `npm run test:integration` | `tests/integration/*.test.ts` | services and route handlers against real Postgres | `app_test` |
| E2E | `npm run test:e2e` | `e2e/*.spec.ts` | the golden demo path in a real browser on a production build | `app_test` |

`npm run test:all` runs all three. CI runs them on every PR.

## Per feature, write

1. **Unit**: the validation schema (one valid case, one or two invalid) and any non-trivial pure logic.
2. **Integration**: the service's main behaviour plus one authorization case (user B can't touch
   user A's row). Import the service or the route handler (`GET`/`POST`) directly. No server needed.
3. **E2E**: extend the golden-path spec if the feature is part of the demo. One spec that mirrors the
   pitch script is worth more than ten edge-case specs.

## Integration test notes

- `tests/integration/setup.ts` refuses to run unless `DATABASE_URL` contains `_test`, syncs the schema
  and truncates TypeORM tables before each test. Tests run serially (one shared DB).
- `server-only` is stubbed for Vitest in `vitest.config.mts`, so service imports work.
- Route handlers: `await POST(new Request("http://test/api/x", { method: "POST", body: JSON.stringify(data) }))`.
- Code that calls `requireUser()`/`getRequestSession()`/`headers()`: mock the session module (see
  `tests/integration/items.test.ts`, which uses a `vi.hoisted` holder to switch users per test).
  ```ts
  vi.mock("@/lib/session", () => ({ requireUser: vi.fn(async () => ({ id: "user-a" })) }));
  ```
  Then change the mock's return value to test as another user.
- Server actions that call `revalidatePath`: `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))`.

## Unit component tests

Use `@testing-library/react` in the `unit` project (jsdom). Test presentational client components
by role/label. Don't unit-test components that import server actions; cover those in E2E.

## Playwright notes

- Always runs `next build && next start` on port 3100 with `.env.test`. That matches what judges see,
  and Next 16 refuses a second `next dev` in the same folder, so your dev server on :3000 can keep running.
- Locators: `getByRole`, `getByLabel`, `getByText`. Next injects a route announcer with `role="alert"`,
  so `getByRole("alert")` matches two elements; assert on text instead.
- Make data unique per run (`Demo item ${Date.now()}`) instead of resetting the DB between specs.
- Signed-in flows: `e2e/auth.setup.ts` signs up one user per run through `/sign-in` and saves
  `storageState`; the `chromium` project reuses it. For signed-out checks:
  `test.use({ storageState: { cookies: [], origins: [] } })`. Don't sign up in every test, because Better
  Auth rate-limits sign-ups (3 per 10 s) in production mode, which is what E2E runs.
- A second user (e.g. "B can't claim A's thing"): `browser.newContext()` and sign up again in the test.
- Right after load, React may keep a hidden copy of a streamed list; scope text assertions to a
  container (`page.getByTestId("item-list")` or `page.locator("main")`) to avoid strict-mode double matches.
- `next start` prints a warning about `output: "standalone"`. It's harmless for tests; the Docker image runs `server.js`.
- Interactive debugging: `npx playwright test --ui`, `npx playwright codegen http://localhost:3000`
  to record locators, and the trace viewer for CI failures (`playwright-report` artifact).
- If the Playwright MCP server is connected, use it to click through the running app while building a
  feature, then turn what worked into a spec.
- First run on a new machine: `npx playwright install chromium` (CI uses `--with-deps`).
