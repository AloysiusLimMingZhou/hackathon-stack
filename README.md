# hackathon-stack

A Claude skill + tested scaffold for hackathon prototypes:
Next.js 16 (TypeScript, App Router) · Tailwind + shadcn/ui · PostgreSQL + TypeORM (Supabase on deploy) ·
Better Auth · Vitest (unit + integration) · Playwright · Docker · GitHub Actions CI/CD · Vercel.

```bash
git clone --depth 1 https://github.com/AloysiusLimMingZhou/hackathon-stack ~/.claude/hackathon-stack
node ~/.claude/hackathon-stack/scripts/scaffold.mjs my-app
cd my-app && npm run setup && npm run dev
```

- `SKILL.md` — instructions Claude follows (also readable by humans)
- `scripts/scaffold.mjs` — creates the app and applies every fix in `references/database.md`
- `assets/templates/` — files copied into new projects
- `references/` — architecture, security, database, testing, delivery (CI/CD, Vercel, Docker) guides
- `evals/` — test prompts used to check the skill

Verified end to end on Next 16.4, TypeORM 1.1, Better Auth 1.7, Vitest 5, Playwright 1.65 (Nov 2026).
