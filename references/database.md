# Database: PostgreSQL + TypeORM in Next.js 16 (and Supabase on deploy)

All of the rules below were verified on Next 16.4 + TypeORM 1.1 + pg 8. Each one prevents a failure
that otherwise shows up mid-hackathon.

## Contents
1. Gotchas and their fixes
2. Entities
3. Dev workflow (sync) vs deploy workflow (migrations)
4. Querying patterns
5. Better Auth's tables
6. Supabase for deployment

## 1. Gotchas and their fixes

| Symptom | Cause | Fix (already in the scaffold) |
|---|---|---|
| `TypeORMError: Cyclic dependency: "u"` only in `next build`/production | Server minification renames entity classes, which corrupts relation metadata. Explicit table names don't help. | `experimental: { serverMinification: false }` in next.config.ts |
| `No metadata for "X" was found` after editing a file in `next dev` | Hot reload creates new entity classes; the cached DataSource still holds the old ones. | `getDb()` in `src/db/data-source.ts` swaps the stale DataSource |
| TS1240 "Unable to resolve signature of property decorator" | Decorators not enabled | `experimentalDecorators` + `emitDecoratorMetadata` in tsconfig |
| Wrong column types / `Data type "Object" is not supported` from CLI or tests | tsx/esbuild/Vite don't emit decorator metadata | Always pass `type` to `@Column`/`@CreateDateColumn` |
| `next build` connects to the DB (and fails on Vercel/Docker) | `cacheComponents` prerenders pages at build | DB reads go in an async child that calls `await connection()`, inside `<Suspense>` |
| "Route segment config runtime is not compatible with cacheComponents" | `export const runtime = "nodejs"` | Delete it; route handlers already run on Node |
| Bundling errors from pg/typeorm optional drivers | Bundler pulls in TypeORM's driver matrix | `serverExternalPackages: ["typeorm", "pg"]` |
| Relations undefined or circular import crash | String targets or eager imports between entities | `@ManyToOne(() => Team, (t) => t.members) team!: Relation<Team>` |
| `function uuid_generate_v4() does not exist` on Supabase | uuid-ossp lives in the `extensions` schema there | `uuidExtension: "pgcrypto"` in the DataSource → `gen_random_uuid()` |
| `npm run db:seed` fails with "cannot truncate a table referenced in a foreign key" | `repository.clear()` truncates one table | seed TRUNCATEs all entity tables together with CASCADE |
| `where: { x: null }` throws (TypeORM 1.x) | 1.0 rejects null/undefined in `where` | Use `IsNull()`; build `where` objects without undefined keys |

## 2. Entities

```ts
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import type { Relation } from "typeorm";
import { Team } from "./Team";

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) name!: string;
  @Column({ type: "integer", default: 0 }) votes!: number;
  @Column({ type: "jsonb", default: () => "'{}'" }) meta!: Record<string, unknown>;
  @Column({ type: "text" }) ownerId!: string;                 // Better Auth user.id (text)
  @ManyToOne(() => Team, (t) => t.projects, { onDelete: "CASCADE" }) team!: Relation<Team>;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
```

- One entity per file in `src/db/entities/`, exported from `entities/index.ts` (`entities` array). Use
  no globs: the bundler can't follow them.
- uuid primary keys (safe to expose in URLs); `timestamptz` for times; `jsonb` for flexible blobs that
  aren't queried relationally (great for hackathon "extra fields").
- Add `@Index()` to columns used in `where`/`order` on growing tables (foreign keys, `ownerId`, `createdAt`).

## 3. Dev workflow vs deploy workflow

**Local dev:** `DB_SYNC=true`. TypeORM creates and alters tables from entities on first `getDb()`.
Fast iteration with no migration files. `npm run db:seed` rebuilds demo data.

**Before the first deploy** there are no migrations yet (dev used `DB_SYNC`), so production would get no
tables. Generate the initial one against an empty database:
```bash
psql "$DATABASE_URL" -c 'CREATE DATABASE app_migrations'          # or any empty DB
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app_migrations DB_SYNC=false \
  npm run db:generate -- src/db/migrations/Init
```
From then on CI's "Migrations match entities" step fails any PR that changes an entity without a migration.

**On every schema change after that:**
```bash
npm run db:generate -- src/db/migrations/AddProjects   # diff entities vs DB → migration file
npm run db:migrate                                      # apply (uses DIRECT_URL if set)
```
Generate against a database that matches production (an empty local DB with `DB_SYNC=false` and
all prior migrations applied); otherwise the diff is empty. Commit migration files; review the SQL,
since TypeORM sometimes drops and re-adds a column for a rename. In CD (`deploy.yml`) migrations
run before the Vercel deploy.

Reset local: `npm run db:down && docker volume rm <project>_pgdata && npm run setup`.

## 4. Querying patterns

```ts
const db = await getDb();
const repo = db.getRepository(Project);

await repo.find({ where: { ownerId }, order: { createdAt: "DESC" }, take: 20, relations: { team: true } });
await repo.findOneBy({ id, ownerId });                         // scoped lookup = authorization
await repo.increment({ id }, "votes", 1);                      // atomic counter
await db.transaction(async (tx) => { /* tx.getRepository(...) for multi-row invariants */ });
await repo.createQueryBuilder("p").where("p.name ILIKE :q", { q: `%${q}%` }).getMany(); // params, never interpolation
```

Avoid N+1 queries in lists: load relations in the query (`relations`) rather than inside a `.map()`.
Paginate anything a user can grow.

## 5. Better Auth's tables

Better Auth creates `user`, `session`, `account`, `verification` through its own CLI
(`npm run auth:migrate`, which runs `npx auth@latest migrate`; the old `@better-auth/cli` package is
deprecated). Don't map them with TypeORM entities (two owners of one table drift apart). Store
`ownerId: text` and join in SQL if you really need user fields, or call `auth.api` for the user.
Integration tests truncate only TypeORM tables, so auth tables survive.

Adding a Better Auth plugin (organization, admin, 2FA…) usually adds tables, so rerun `auth:migrate`
for dev, test and production.

## 6. Supabase for deployment

Create a project (pick the region nearest the judges/users; Singapore for Malaysia), then in
**Connect** copy two strings:

| Env var | Supabase connection | Port | Used by |
|---|---|---|---|
| `DATABASE_URL` | Shared pooler, **transaction mode** | 6543 | the app on Vercel (many short-lived functions) |
| `DIRECT_URL` | Shared pooler, **session mode** | 5432 | migrations, `auth:migrate`, seed scripts |

Use the session pooler, not "Direct connection", for `DIRECT_URL`: the direct host is IPv6-only and
GitHub Actions runners (and many home networks) are IPv4-only, so migrations fail with `ENETUNREACH`.

Also set `DATABASE_SSL=true`, keep `DB_POOL_MAX` small (default 3), and never set `DB_SYNC` in production.
Don't append `?sslmode=require` to the URLs: node-postgres then demands full certificate verification
and fails against Supabase; `DATABASE_SSL=true` handles TLS. Don't use Vercel's Supabase integration
for this app: it injects `POSTGRES_*` variables the app doesn't read. If you don't use supabase-js in the
browser, turn off the Data API (Project Settings → Data API) so tables aren't exposed over REST.
Transaction mode doesn't support prepared statements. node-postgres (used by TypeORM and Better Auth)
only prepares statements you explicitly name, so the default setup works. Don't add `name:` to queries.

Migrate production from your laptop (or let `deploy.yml` do it):
```bash
DATABASE_URL="$DIRECT_URL" DATABASE_SSL=true npm run db:migrate
DATABASE_URL="$DIRECT_URL" DATABASE_SSL=true npm run auth:migrate
```
(PowerShell: `$env:DATABASE_URL=...; npm run db:migrate`.)

Seeding production for the demo: run `npm run db:seed` the same way, deliberately, once.
