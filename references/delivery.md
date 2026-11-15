# Delivery: GitHub, CI/CD, Vercel, Docker

## Contents
1. GitHub through the connector
2. Branch & PR workflow
3. CI (`.github/workflows/ci.yml`)
4. CD (`.github/workflows/deploy.yml`)
5. Vercel setup (connector or CLI)
6. Docker
7. Env var matrix

## 1. GitHub through the connector

Use the GitHub connector (MCP) for GitHub API work: creating the repo, branches, PRs, reviews,
issues, checking CI status, merging. Look for tools named like `create_repository`,
`create_pull_request`, `get_pull_request_status`/`list_workflow_runs`, `merge_pull_request`
(prefix varies, e.g. `mcp__github__*`). Use local `git` for commits and pushes, which is faster and
keeps history intact. If no GitHub connector is available, search the connector registry and suggest
it; meanwhile fall back to the `gh` CLI.

First push:
1. Ask visibility if the user hasn't said. Many hackathons require a **public** repo for judging; if
   unsure, create it private and remind them to flip it before submission.
2. Create the repo with the connector (no auto-init: the scaffold already has a commit), named after the app.
3. `git remote add origin <clone_url>` → `git push -u origin main`.
4. Turn on branch protection for `main` (require the CI `checks` job) if the connector supports it,
   otherwise tell the user where to click (Settings → Branches).
5. Add repository secrets for CD when Vercel is set up (§4). Secrets are entered by the user in GitHub
   settings or via `gh secret set`. Never echo secret values into the chat.

## 2. Branch & PR workflow

- `main` is always deployable. One short-lived branch per feature: `feat/voting`, `fix/login-redirect`.
- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`), small and frequent.
- Before opening a PR: `npm run lint && npm run typecheck && npm run test && npm run test:integration`.
- Open the PR via the connector. Title = conventional commit. Body: what changed, how to test, screenshot
  for UI changes, linked issue. Vercel posts a preview URL on the PR; click through it.
- Wait for CI green, then squash-merge via the connector and delete the branch. Merging to main triggers CD.
- Teammates: one person owns `main` merges during the final hours ("merge freeze" ~1 hour before
  submission, only fixes after that).

## 3. CI

Runs on every PR and push to main:
`npm ci` → `npm audit` (prod deps, high+) → lint → typecheck → unit → Better Auth tables → integration
→ Playwright (prod build) → upload report on failure. A parallel `docker` job proves the image builds.
Postgres runs as a service container. Env mirrors `.env.test`.

When CI fails: read the failing step's log (connector: workflow run logs, or `gh run view --log-failed`),
reproduce locally with the same npm script, fix, and push to the same branch.

## 4. CD

`deploy.yml` runs after CI succeeds on `main` (or manually via *Run workflow*):
1. **Migrate**: `db:migrate` + `auth migrate` against `DIRECT_URL` (Supabase).
2. **Deploy**: `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
3. **Smoke test**: `curl --fail <url>/api/health`.
4. **Image**: build and push `ghcr.io/<owner>/<repo>:{sha,latest}`.

`vercel.json` sets `git.deploymentEnabled.main = false`, so Vercel's Git integration keeps creating
**preview** deployments for PRs while production comes only from this pipeline, after migrations.

Required GitHub **secrets**: `VERCEL_TOKEN` (vercel.com/account/tokens), `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID` (from `.vercel/project.json` after `npx vercel link`; answer *No* when it offers to
pull env vars, or production credentials land in a local `.env.local`), `DIRECT_URL` (Supabase session
pooler, port 5432). Required **variable**: `PRODUCTION_URL` (the public production domain; per-deployment
URLs return 401 behind Vercel Deployment Protection, so the smoke test uses this). The workflow's first
step fails with a clear message if any are missing. Optionally put them on a GitHub **Environment** named
`production` with required reviewers.

The job only runs for a successful CI run triggered by a **push** to `main` in this repo, or a manual run
on `main`. A fork PR whose branch happens to be named `main` can't reach production secrets.

Simpler alternative (no DB yet, or the team wants zero setup): delete `deploy.yml`'s `production` job and
`vercel.json`, let Vercel auto-deploy `main`, and run migrations by hand before merging schema changes.

## 5. Vercel setup

With the **Vercel connector** (`mcp__Vercel__*` tools) available:
- Create/link the project from the GitHub repo (`create_git_project` / `create_project`), framework Next.js.
- Set env vars with `create_project_env` per target (production / preview / development). Ask the user
  for secret values or have them paste into the dashboard. Don't invent or print secrets.
- After a deploy: `list_deployments` → `get_deployment` for build status/logs;
  production errors → `get_runtime_errors`, then `get_runtime_logs`.
- Hand the user any `requires_user_action` dashboard URL instead of guessing.

Without the connector: `npx vercel link` → `npx vercel env add BETTER_AUTH_SECRET production` (etc.) →
`npx vercel deploy` for a preview.

Set the Vercel function region to the Supabase region (Project Settings → Functions); every query
crosses that gap.

Better Auth on Vercel: set `BETTER_AUTH_URL` to the production URL in the Production scope only.
Previews are trusted through `VERCEL_URL`/`VERCEL_BRANCH_URL` in `trustedOrigins`. OAuth providers need
the production callback URL (`https://<app>/api/auth/callback/github`) added in the provider console.

## 6. Docker

- `Dockerfile`: multi-stage, Next `output: "standalone"`, Node 22 alpine, non-root `nextjs` user,
  `HEALTHCHECK` on `/api/health`, no secrets baked in (the builder's `BETTER_AUTH_SECRET` is a
  placeholder that never reaches the final image).
- Local production-like run: `npm run docker:app` (= `docker compose --profile app up --build`) → http://localhost:8080.
  The app container reads `.env`, with `DATABASE_URL` overridden to the `db` service. Run
  `npm run auth:migrate` first (from the host, against :5432). With `DB_SYNC=true` in `.env`, TypeORM
  creates its tables on first request; for a real environment run `npm run db:migrate` instead.
- The standalone image has no TypeORM CLI/tsx. Migrations run from CI or a laptop, never inside the container.
- Day-to-day dev doesn't use the app container: `npm run db:up` starts only Postgres.
- Published image: `ghcr.io/<owner>/<repo>`, which suits judges who want to self-host, or a fallback
  host (Railway, Fly, Render, a VPS) if Vercel misbehaves on demo day.

## 7. Env var matrix

| Var | Local `.env` | `.env.test` / CI | Vercel Production | Vercel Preview |
|---|---|---|---|---|
| `DATABASE_URL` | docker `app` | docker/CI `app_test` | Supabase pooler :6543 | Supabase pooler (or a separate dev project) |
| `DIRECT_URL` | – | – | GitHub secret only: Supabase session pooler :5432 | – |
| `DATABASE_SSL` | false | false | true | true |
| `DB_SYNC` | true | true | **unset** | unset |
| `BETTER_AUTH_SECRET` | generated | test value | strong random | strong random (different) |
| `BETTER_AUTH_URL` | http://localhost:3000 | http://localhost:3100 | https://<prod-domain> | unset |
| `GITHUB_CLIENT_ID/SECRET` | dev OAuth app | – | prod OAuth app | – |
