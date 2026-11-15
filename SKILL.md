---
name: hackathon-stack
description: Standard full-stack setup and conventions for hackathon prototypes. Next.js 16 + TypeScript (frontend and backend), Tailwind + shadcn/ui, PostgreSQL + TypeORM (Supabase when deployed), Better Auth, Vitest + Playwright, Docker, GitHub Actions CI/CD via the GitHub connector, deployed on Vercel. Use whenever the user starts, scaffolds, extends, tests, deploys or submits a hackathon, datathon, buildathon, game jam, competition, MVP or demo-day project, even if they don't name the stack ("set up our repo for the hackathon", "add voting to our hackathon app", "deploy before judging").
---

# Hackathon stack

One standard stack for every hackathon, so the team spends its hours on the idea and not on setup.
The scaffold and templates in this skill were run end to end on Next 16.4, TypeORM 1.1, Better Auth 1.7,
Vitest 5 and Playwright 1.65. Their comments explain non-obvious lines; keep them.

| Concern | Choice |
|---|---|
| Frontend + backend | Next.js 16 App Router, TypeScript strict, server components, server actions, route handlers |
| UI | Tailwind v4 + shadcn/ui |
| Database | PostgreSQL 17 via Docker locally + TypeORM 1.x; Supabase Postgres when deployed |
| Auth | Better Auth (email/password, optional GitHub OAuth), same Postgres |
| Tests | Vitest unit + integration (real Postgres), Playwright E2E |
| CI/CD | GitHub Actions: CI on every PR; CD = migrate → Vercel prod → smoke test → GHCR image |
| Containers | Multi-stage, non-root Docker image (Next standalone) + docker compose |
| Hosting | Vercel (previews per PR, production from CD) |
| Git/GitHub | GitHub connector for repo/PR/CI work, local git for commits |

If a hackathon *requires* different tech (a sponsor's database, a mandated language), swap only that
piece, say so, and keep everything else standard.

## Which workflow

- **New project** → "Scaffold a new project" below.
- **Existing project** (has `AGENTS.stack.md` or this stack's layout) → "Building features".
- **Shipping** → "Deploy & submit", plus `references/delivery.md`.

## Get the skill files first

The scaffold script, templates and references live in the GitHub repo
`AloysiusLimMingZhou/hackathon-stack`. Before anything else, make sure a local copy exists and call
its folder `SKILL_HOME`. All paths below (`scripts/`, `assets/`, `references/`) are relative to it.

- If this SKILL.md is already inside a clone of that repo, `SKILL_HOME` is its folder.
- Otherwise use `~/.claude/hackathon-stack` (Windows: `%USERPROFILE%\.claude\hackathon-stack`):
  ```bash
  git clone --depth 1 https://github.com/AloysiusLimMingZhou/hackathon-stack ~/.claude/hackathon-stack \
    || git -C ~/.claude/hackathon-stack pull --ff-only
  ```
  In a cloud/sandbox session without access to the home folder, clone into the working directory instead.
- If the clone fails (repo missing, private without credentials, no network), tell the user and fall back
  to the rules in this file plus `AGENTS.stack.md` in their project. Don't recreate the templates from memory.

Read the matching reference before working in that area:

| File | Read when |
|---|---|
| `references/architecture.md` | adding any feature; deciding where code goes; reviewing code quality |
| `references/security.md` | anything with users, auth, user-owned data, uploads, LLM calls, secrets; before submission |
| `references/database.md` | entities, queries, migrations, Supabase, any TypeORM error |
| `references/testing.md` | writing or fixing tests |
| `references/delivery.md` | GitHub repo/PRs, CI/CD, Vercel, Docker, env vars |

## Scaffold a new project

Ask only what you can't infer (combine into one question): app name (kebab-case), repo visibility
(many hackathons require public), and whether teammates need repo access. Then:

1. **Scaffold.** From the folder that should contain the app:
   ```bash
   node "$SKILL_HOME/scripts/scaffold.mjs" <app-name>
   ```
   It runs create-next-app, installs deps, copies `assets/templates/*`, patches tsconfig / next.config /
   package.json / .gitignore, writes `.env` with a random secret, runs shadcn init and installs
   Playwright Chromium (best effort), and makes the first commit. Read its "Needs attention" list and
   rerun anything it printed. Network-restricted machines commonly block the shadcn registry or the
   Playwright CDN.
   Don't hand-write these files instead. The script encodes fixes for real breakages (listed in
   `references/database.md`). Never overwrite the generated `next.config.ts`: it carries the Tailwind
   Turbopack rule. Extend it.
2. **Start the database and verify.** In the app folder:
   ```bash
   npm run setup     # docker Postgres (app + app_test) → Better Auth tables (dev+test) → demo seed
   npm run lint && npm run typecheck && npm run test:all
   ```
   Everything must be green before you build features. If Docker isn't available, point `DATABASE_URL`
   in `.env` and `.env.test` at any local Postgres with `app` and `app_test` databases.
3. **Replace the example domain.** `Item`, `/items`, `src/server/items.ts`, `/sign-in` and their tests are a
   working, secure-by-default reference slice (entity → validation → service → authenticated
   action/route → page → unit/integration/E2E with a signed-in setup project). Keep `/sign-in`.
   Rename or copy them into the real domain, then delete what's unused. Also fill in the README:
   pitch line, setup commands, a "Decisions" section.
4. **GitHub** via the connector (`references/delivery.md` §1): create the repo, add the remote, push
   `main`, protect `main` with the CI check. CI starts running immediately.
5. **Vercel early.** Deploy hour-1, not hour-23: import the repo (Vercel connector or `npx vercel link`).
   Until Supabase exists, a preview without a DB is fine. Then create Supabase, set env vars per
   `references/delivery.md` §7, add the GitHub secrets for `deploy.yml`, and run the first migration.

## Building features

For every feature, follow the layered slice in `references/architecture.md`:

1. Entity (if new data) → register in `src/db/entities/index.ts`. Local dev picks it up via `DB_SYNC`.
2. zod schema in `src/lib/validation/` → unit test it.
3. Service in `src/server/<feature>.ts`: `import "server-only"`, takes the acting `userId` for anything
   user-owned and scopes queries by it → integration test, including one "other user can't" case.
4. Entry point: server action for UI mutations, route handler only for external callers. Keep it thin:
   parse → `requireUser()` → service → response.
5. UI: server component page; DB reads in an async child with `await connection()` inside `<Suspense>`;
   `"use client"` only on interactive leaves; shadcn components (`npx shadcn@latest add <name>`).
6. If it's part of the demo, extend the golden-path E2E spec.
7. Branch `feat/<name>` → conventional commits → PR through the connector → CI green → squash-merge.

Before using a Next.js API you're unsure about, check `node_modules/next/dist/docs/`, which matches the
installed version. Next 16 differs from older training data: `proxy.ts` instead of `middleware.ts`,
async `params`/`headers()`, `cacheComponents`, no `export const runtime` with cacheComponents.

Keep the code a tired teammate can read: clear names, small functions, early returns, no `any`, no
speculative abstractions, comments only for *why*. Details in `references/architecture.md` §4.

## Deploy & submit

- **First deploy**: there are no migrations yet. Generate `Init` against an empty database
  (`references/database.md` §3) and commit it, or production gets no tables.
- Schema changed since last deploy? `npm run db:generate -- src/db/migrations/<Name>` and commit it.
  CI fails PRs whose entities and migrations disagree; `deploy.yml` applies migrations before deploying.
- Merge to `main` → CI → Deploy workflow → check the smoke test passed and open the production URL.
  With the Vercel connector, inspect `list_deployments` / `get_runtime_errors` when something's off.
- Seed production demo data deliberately once (`references/database.md` §6).
- Run the pre-submission checklist in `references/security.md` §6.
- ~1 hour before the deadline: merge freeze, flip repo visibility if required, verify the README
  setup steps from a clean clone, record a backup demo video.

## Hackathon playbook

- **Demo-first.** Write the 2-minute demo script early; the golden-path E2E spec mirrors it. Build only
  what the script shows; fake the rest convincingly (seeded data, stubbed integrations behind a service function).
- **Always deployable.** Small PRs, CI green, production URL working from hour 1. A broken main the
  night before judging is the most common way teams lose.
- **Time-box.** If something fights you for 30+ minutes, choose the simpler path and note it in README "Decisions".
- **Polish where judges look**: loading/empty/error states on the demo path, a real-looking seed, mobile width.

## Templates (assets/templates → project)

`db/` → `src/db` (data source, CLI data source, entities, seed) · `server/` → `src/server` ·
`lib/` → `src/lib` (auth, session, env validation, security headers, validation) · `app/` → `src/app`
(health, auth and items API routes, items page + actions, sign-in page) · `proxy.ts`, `instrumentation.ts` → `src/` ·
`tests/`, `e2e/`, `vitest.config.mts`, `playwright.config.ts` · `Dockerfile`, `dockerignore`,
`docker-compose.yml`, `db-init/` · `github/` → `.github` (ci.yml, deploy.yml, dependabot.yml) ·
`vercel.json` · `env.example`, `env.test` · `with-env.mjs` → `scripts/` · `agent-rules.md` →
`AGENTS.stack.md` (rules for any coding agent; `CLAUDE.md` imports it).
If you add something to an existing project by hand, copy the template file rather than rewriting it from memory.
