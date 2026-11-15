# Security baseline

Hackathon code ends up public on GitHub and live on the internet, often with real sign-ups. The
scaffold ships these defaults; keep them, and apply the checklist to every feature you add.

## Contents
1. What the scaffold already does
2. Authorization (the one you must write yourself)
3. Input, output and data handling
4. Secrets
5. Supply chain & CI
6. Pre-submission checklist

## 1. What the scaffold already does

| Control | Where |
|---|---|
| Env validated at server start, fails fast; `DB_SYNC` forbidden in Vercel production | `src/lib/env.ts`, `src/instrumentation.ts` |
| Security headers (HSTS, nosniff, frame-ancestors/X-Frame-Options DENY, referrer, permissions, base-uri/form-action/object-src CSP); `X-Powered-By` off | `src/lib/security-headers.ts`, `next.config.ts` |
| Auth: Better Auth with hashed passwords (min 8 chars), secure httpOnly cookies, CSRF origin checks, rate limiting in production | `src/lib/auth.ts` |
| Optimistic route guard plus real server-side session checks | `src/proxy.ts`, `src/lib/session.ts` |
| Parameterized SQL via TypeORM; DB code isolated behind `server-only` services | `src/server/*` |
| Health endpoint that hides error details | `src/app/api/health/route.ts` |
| Non-root Docker user, no secrets in image, `.dockerignore` excludes `.env*` | `Dockerfile`, `.dockerignore` |
| Least-privilege workflow tokens, `npm audit` gate, Dependabot | `.github/` |

## 2. Authorization

Authentication (who you are) comes from Better Auth. Authorization (what you may touch) is your
code, and it's the most common hole in prototypes. Rules:

- **Every** server action and route handler that reads or writes user-owned data gets the user from
  the session, never from the request body or a hidden form field.
- Services take the acting user's id and **scope the query** with it, so another user's id in the URL
  returns nothing:

```ts
// src/server/items.ts
export async function deleteItem(id: string, userId: string) {
  const db = await getDb();
  const result = await db.getRepository(Item).delete({ id, ownerId: userId }); // scoped, not just { id }
  if (result.affected === 0) throw new NotFoundError(); // same response for "missing" and "not yours"
}

// src/app/items/actions.ts
export async function deleteItemAction(id: string) {
  const user = await requireUser();          // from the session cookie
  await deleteItem(z.string().uuid().parse(id), user.id);
  revalidatePath("/items");
}
```

- `proxy.ts` only checks that a cookie exists, which is fine for redirects but not a security boundary.
  The check that counts is `requireUser()` in the action, handler or page.
- Admin-only features: add a `role` field through Better Auth's `admin` plugin, or an allow-list
  of emails in env. Never use a client-side flag.
- Write one integration test per protected service proving that user B can't read or modify user A's data.

## 3. Input, output and data handling

- Parse every external input with zod (body, form data, search params, route params, webhook payloads).
  Limit string lengths and array sizes so one request can't store megabytes.
- Never build SQL strings from input. If you need raw SQL, use parameters: `db.query("... WHERE id = $1", [id])`.
  QueryBuilder: `.where("x.name = :name", { name })`, never template literals.
- Return explicit fields (DTOs) when an entity has anything sensitive. Never return Better Auth's
  `account` rows or tokens.
- React escapes output by default. Don't use `dangerouslySetInnerHTML` with user or LLM content
  unless it has been sanitized.
- File uploads: check type and size on the server, store in object storage (Supabase Storage / Vercel
  Blob) with random names, and never serve them from your own origin as HTML.
- LLM features: treat model output as untrusted input (validate before acting on it). Keep provider
  keys server-side, and rate-limit endpoints that spend money.
- Webhooks: verify the provider's signature before parsing the body.

## 4. Secrets

- `.env` is git-ignored; `.env.example` documents every variable with fake values; `.env.test`
  has only throwaway test values. Never paste a real key into code, tests, README or an issue.
- Anything prefixed `NEXT_PUBLIC_` ships to the browser. Never give a secret that prefix.
- Production secrets live in Vercel env vars (Production/Preview scopes) and GitHub Actions secrets.
  Generate auth secrets with `npx auth@latest secret` or `openssl rand -base64 32`.
- If a secret is ever committed: rotate it first, then clean history. Rotation is what makes you safe.
- Supabase: the app talks to Postgres directly with the DB password. If you also use supabase-js
  in the browser, use only the anon key and turn on Row Level Security for every table it can reach.

## 5. Supply chain & CI

- Commit `package-lock.json`; CI uses `npm ci`. Add dependencies deliberately, and prefer well-known
  packages over five-star clones.
- CI runs `npm audit --omit=dev --audit-level=high`; fix by updating, not by deleting the step.
- Workflows declare `permissions:` explicitly (read-only by default; `packages: write` only for the
  image push job). Deploy credentials live in the `production` environment.
- Public repo: GitHub secret scanning with push protection is on by default, so keep it on. Optional:
  enable CodeQL (Security → Code scanning → Default setup; free on public repos).

## 6. Pre-submission checklist

- [ ] No secrets in the repo (`git log -p | grep -iE "secret|password|api[_-]?key"` comes back clean)
- [ ] Every mutation authorizes with the session user; the cross-user test exists and passes
- [ ] `DB_SYNC` is unset or false in Vercel Production; migrations are applied
- [ ] Demo/seed accounts use throwaway passwords that aren't reused anywhere
- [ ] Error pages show no stack traces (check `/api/does-not-exist` and a forced error in production)
- [ ] `npm audit --omit=dev` is clean, or the remaining issues are understood
