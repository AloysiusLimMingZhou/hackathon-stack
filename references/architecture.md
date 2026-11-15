# Architecture & clean code

The goal at a hackathon is a prototype that works on demo day and that four tired people can still
read at 3 a.m. That favours a small number of obvious layers and boring, explicit code over
abstractions. Every rule below exists to keep a change in one place.

## Contents
1. Layers and dependency direction
2. Where a new feature's code goes (worked example)
3. Server actions vs route handlers
4. Clean code rules
5. Errors
6. Recording decisions

## 1. Layers and dependency direction

```
UI (src/app pages, src/components)          ← renders, collects input, no DB/business rules
   │ calls
Entry points (actions.ts, api/**/route.ts)   ← parse input, check auth, call ONE service, shape the response
   │ calls
Services (src/server/*.ts)                   ← business rules + authorization + data access via TypeORM
   │ uses
Data (src/db: entities, data-source, migrations)
Shared (src/lib/validation, src/lib/*)       ← zod schemas & pure helpers, importable from anywhere
```

Dependencies only point downwards. A service never imports from `src/app`; a component never imports
`getDb`. `import "server-only"` at the top of every service makes the second mistake a build error.

Why services, even in a prototype: the same operation is usually triggered from a page, a server
action and an API route (or an AI tool call). Putting rules in one function means one place to fix,
and it is the seam integration tests hit.

Not worth it at a hackathon: repositories wrapping TypeORM repositories, DI containers, CQRS,
"domain" vs "application" service splits, generic base classes. Add a layer only when the same
pain shows up twice.

## 2. Where a new feature's code goes

Feature: "teams can post updates".

| Step | File |
|---|---|
| Entity | `src/db/entities/Update.ts` (+ register in `entities/index.ts`) |
| Validation | `src/lib/validation/updates.ts` — `createUpdateInput` zod schema |
| Service | `src/server/updates.ts` — `listUpdates(teamId)`, `postUpdate(input, userId)` |
| UI mutation | `src/app/teams/[id]/actions.ts` — `postUpdateAction` |
| Page | `src/app/teams/[id]/page.tsx` — async child + `<Suspense>` |
| External API (only if needed) | `src/app/api/teams/[id]/updates/route.ts` |
| Tests | `src/lib/validation/updates.test.ts`, `tests/integration/updates.test.ts`, extend the golden-path `e2e/*.spec.ts` |
| Migration (before deploy) | `npm run db:generate -- src/db/migrations/AddUpdates` |

Group by feature inside each layer (`server/updates.ts`, `server/teams.ts`), not by technical type
(`server/queries.ts`, `server/mutations.ts`).

## 3. Server actions vs route handlers

- **Server action** (`"use server"` in `actions.ts`): mutations triggered by your own UI. Gets
  progressive enhancement, `useActionState` pending/error state and `revalidatePath` for free.
- **Route handler** (`app/api/**/route.ts`): anything called by something that isn't your React
  UI: webhooks, mobile apps, cron, another team's service, streaming AI responses.
- **Reads**: call services directly from server components. Don't fetch your own API from the server.

Server actions are public HTTP endpoints. Treat their input as untrusted, and authorize inside them
just like a route handler (see security.md).

## 4. Clean code rules

- **Names say what, not how.** `listOpenTicketsForTeam(teamId)` over `getData(id)`. Booleans read as
  questions (`isPublished`, `hasVoted`). Files are named after the thing they hold.
- **Small functions, one level of abstraction.** A service function reads like a short story: validate →
  authorize → load → change → save → return. If you need a comment to separate sections, extract a function.
- **Validate at the edge, trust inside.** zod parses input once in the service or action; past that
  point types are real and functions don't re-check.
- **Return early.** Guard clauses instead of nested `if/else` pyramids.
- **No magic values.** Constants at the top of the module (`const MAX_TEAM_SIZE = 5`) or in zod schemas.
- **Types from one source.** `z.infer<typeof schema>` for inputs, entity classes for rows. Don't
  hand-write duplicate interfaces. No `any`; use `unknown` and narrow it.
- **Components**: server components by default; add `"use client"` only to the leaf that needs state
  or events. Keep data fetching out of client components.
- **Comments explain why** (a constraint, a gotcha, a decision), never what the next line does.
- **Delete dead code.** Git remembers. Commented-out blocks and unused exports confuse the next reader.
- **Consistency beats preference.** Follow the existing pattern in the file you're editing, even if
  you'd have chosen differently.

## 5. Errors

- Expected failures (validation, not found, not allowed) are values: actions return
  `{ error: string }`, route handlers return 4xx JSON. Show them in the UI.
- Unexpected failures are thrown and left to Next's `error.tsx` boundary. Log with context on the
  server, but never send stack traces, SQL or connection strings to the client.
- Add `src/app/error.tsx` and `src/app/not-found.tsx` early, so a demo crash looks deliberate rather than broken.

## 6. Recording decisions

Keep a short "Decisions" section in the README, one line each: what you chose, the alternative, and why.
For example: "Postgres full-text search instead of a vector DB: 40 docs, no time to run another service."
Judges ask, and teammates who join late read it.
