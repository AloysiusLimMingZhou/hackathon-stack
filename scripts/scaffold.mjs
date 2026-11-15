#!/usr/bin/env node
/**
 * Hackathon stack scaffold — Next.js 16 (TS, App Router, Tailwind) + shadcn/ui + TypeORM/Postgres
 * + Better Auth + Vitest + Playwright + GitHub Actions, ready for Vercel.
 *
 * Usage:  node <skill>/scripts/scaffold.mjs <app-name> [--no-shadcn] [--no-browsers] [--no-git]
 * Run it from the folder that should CONTAIN the new app. Cross-platform (macOS/Linux/Windows).
 *
 * Network steps (shadcn registry, Playwright browser download) are best-effort: if they fail the
 * script prints the exact command to rerun instead of aborting.
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const T = path.join(here, "..", "assets", "templates");

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (f) => args.includes(f);
if (!name || !/^[a-z0-9][a-z0-9-_]*$/.test(name)) {
  console.error("Usage: node scaffold.mjs <app-name>   (lowercase, digits, - or _)");
  process.exit(1);
}
const root = path.resolve(process.cwd(), name);
if (fs.existsSync(root)) {
  console.error(`✖ ${root} already exists — pick another name or delete it first.`);
  process.exit(1);
}

const warnings = [];
const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: opts.cwd ?? root, env: { ...process.env, ...opts.env } });
};
const tryRun = (cmd, hint) => {
  try {
    run(cmd);
    return true;
  } catch {
    warnings.push(`${hint}\n    → rerun: ${cmd}`);
    return false;
  }
};
const copy = (from, to) => {
  const dest = path.join(root, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(path.join(T, from), dest, { recursive: true });
};
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, v) => fs.writeFileSync(path.join(root, p), JSON.stringify(v, null, 2) + "\n");

// 1. Next.js app ------------------------------------------------------------------------------
run(
  `npx --yes create-next-app@latest ${name} --ts --tailwind --eslint --app --src-dir ` +
    `--import-alias "@/*" --use-npm --turbopack --yes --disable-git`,
  { cwd: process.cwd() },
);

// 2. Dependencies -----------------------------------------------------------------------------
run("npm install typeorm pg reflect-metadata better-auth zod server-only");
run(
  "npm install -D auth @types/node@^22 @types/pg tsx vitest @vitejs/plugin-react jsdom " +
    "@testing-library/react @testing-library/dom @playwright/test",
);

// 3. Templates --------------------------------------------------------------------------------
const files = [
  ["docker-compose.yml", "docker-compose.yml"],
  ["db-init", "db-init"],
  ["env.example", ".env.example"],
  ["env.test", ".env.test"],
  ["db", "src/db"],
  ["lib", "src/lib"],
  ["instrumentation.ts", "src/instrumentation.ts"],
  ["Dockerfile", "Dockerfile"],
  ["dockerignore", ".dockerignore"],
  ["vercel.json", "vercel.json"],
  ["server", "src/server"],
  ["app/api", "src/app/api"],
  ["app/items", "src/app/items"],
  ["app/sign-in", "src/app/sign-in"],
  ["proxy.ts", "src/proxy.ts"],
  ["vitest.config.mts", "vitest.config.mts"],
  ["tests", "tests"],
  ["playwright.config.ts", "playwright.config.ts"],
  ["e2e", "e2e"],
  ["github", ".github"],
  ["with-env.mjs", "scripts/with-env.mjs"],
  ["agent-rules.md", "AGENTS.stack.md"],
];
for (const [from, to] of files) copy(from, to);
fs.mkdirSync(path.join(root, "src/db/migrations"), { recursive: true });
fs.writeFileSync(path.join(root, "src/db/migrations/.gitkeep"), "");

// .env with a real secret
const env = fs
  .readFileSync(path.join(root, ".env.example"), "utf8")
  .replace("replace-me-with-a-long-random-string", randomBytes(32).toString("base64url"));
fs.writeFileSync(path.join(root, ".env"), env);

// 4. Config patches ---------------------------------------------------------------------------
// tsconfig: TypeORM decorators
const ts = readJson("tsconfig.json");
Object.assign(ts.compilerOptions, { experimentalDecorators: true, emitDecoratorMetadata: true });
writeJson("tsconfig.json", ts);

// next.config.ts: EXTEND the generated config (it carries the Tailwind/Turbopack rules) — never overwrite
const ncPath = path.join(root, "next.config.ts");
let nc = fs.readFileSync(ncPath, "utf8");
const anchor = /const nextConfig: NextConfig = \{\n/;
const block =
  '  output: "standalone", // self-contained server for the Docker image (Vercel ignores it)\n' +
  "  poweredByHeader: false,\n" +
  "  // TypeORM: keep it (and the pg driver) out of the bundle, and keep class names intact —\n" +
  "  // minified entity names break relation metadata in production builds.\n" +
  '  serverExternalPackages: ["typeorm", "pg"],\n' +
  "  experimental: { serverMinification: false },\n" +
  "  async headers() {\n" +
  '    return [{ source: "/(.*)", headers: securityHeaders }];\n' +
  "  },\n";
if (!anchor.test(nc) || /serverMinification|serverExternalPackages|experimental\s*:|headers\s*\(/.test(nc)) {
  warnings.push("next.config.ts has an unexpected shape — merge this in by hand:\n" + block);
} else {
  nc = 'import { securityHeaders } from "./src/lib/security-headers";\n' + nc.replace(anchor, (m) => m + block);
  fs.writeFileSync(ncPath, nc);
}

// package.json scripts
const pkg = readJson("package.json");
pkg.engines = { node: ">=20.12" };
Object.assign(pkg.scripts, {
  // next typegen: route types (LayoutProps, PageProps…) must exist before tsc on a clean checkout
  typecheck: "next typegen && tsc --noEmit",
  test: "vitest run --project unit",
  "test:watch": "vitest --project unit",
  "test:integration": "vitest run --project integration",
  "test:e2e": "playwright test",
  "test:all": "npm run test && npm run test:integration && npm run test:e2e",
  "db:up": "docker compose up -d --wait",
  "db:down": "docker compose down",
  typeorm: "tsx node_modules/typeorm/cli.js",
  "db:generate": "npm run typeorm -- migration:generate -d src/db/cli-data-source.ts",
  "db:migrate": "npm run typeorm -- migration:run -d src/db/cli-data-source.ts",
  "db:revert": "npm run typeorm -- migration:revert -d src/db/cli-data-source.ts",
  "db:seed": "tsx src/db/seed.ts",
  "auth:migrate": "auth migrate --yes", // Better Auth CLI, pinned as a devDependency
  "docker:app": "docker compose --profile app up --build",
  "auth:migrate:test": "node scripts/with-env.mjs .env.test auth migrate --yes",
  setup: "npm run db:up && npm run auth:migrate && npm run auth:migrate:test && npm run db:seed",
});
writeJson("package.json", pkg);

// .gitignore: create-next-app ignores every .env* — keep the safe ones committed
fs.appendFileSync(
  path.join(root, ".gitignore"),
  "\n# hackathon-stack\n!.env.example\n!.env.test\n/test-results/\n/playwright-report/\n/blob-report/\n/e2e/.auth/\n",
);

// Agent rules: next's AGENTS.md is regenerated by `next dev`; keep our rules in a sibling file
fs.writeFileSync(path.join(root, "CLAUDE.md"), "@AGENTS.md\n@AGENTS.stack.md\n");

// 5. Best-effort network steps ----------------------------------------------------------------
if (!flag("--no-shadcn")) {
  if (tryRun("npx --yes shadcn@latest init -d -y", "shadcn/ui init failed (needs ui.shadcn.com)")) {
    tryRun(
      "npx --yes shadcn@latest add button input label textarea card sonner -y",
      "shadcn components were not added",
    );
  }
}
if (!flag("--no-browsers")) {
  tryRun("npx playwright install chromium", "Playwright browser download failed (needs cdn.playwright.dev)");
}

// 6. Git --------------------------------------------------------------------------------------
if (!flag("--no-git")) {
  tryRun("git init -b main", "git init failed");
  tryRun("git add -A", "git add failed");
  tryRun('git commit -q -m "chore: scaffold hackathon stack"', "initial commit failed (is git user.name/email set?)");
}

console.log(`\n✔ Scaffolded ${root}\n
Next:
  cd ${name}
  npm run setup        # docker Postgres + Better Auth tables (dev & test) + demo seed
  npm run dev          # http://localhost:3000/items
  npm run test:all     # unit + integration + e2e`);
if (warnings.length) console.log(`\n⚠ Needs attention:\n  - ${warnings.join("\n  - ")}`);
