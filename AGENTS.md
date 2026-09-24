# AGENTS.md

## Tooling

Bun, not npm — always. Install deps with `bun install`, add them with `bun add`, and run scripts with `bun run <script>` (never `npm run`, `npm install`, or `npx`; inside scripts use `bunx`, not `npx`). Key commands:

- `bun install` — install dependencies
- `bun run typecheck` — TypeScript check (`tsc --noEmit`)
- `bun run build` — compile to `dist/` (tsc + copy renderer assets)
- `bun start` — build and launch the Electron app

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role triage label vocabulary, labels equal to role names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
