# 01 - Host the docs site on GitHub Pages

Type: task
Status: grilled — spec settled, ready to implement

## Goal

Publish a user-facing docs site for the app on GitHub Pages. The site is
**new content written for app users** — it is *not* a render of `CONTEXT.md`,
`docs/adr/`, or `docs/agents/` (those stay repo-only, for agents).

## Generator: Starlight (Astro)

Chosen over VitePress/Docusaurus/MkDocs/mdBook: docs-shaped UX (nav, sidebar,
search, dark mode), Node/Bun-native, smallest config surface for this size.
Maintenance later = editing markdown.

## Site location & layout

`docs/` itself is the Astro project root (no `docs-site/`, no second
package.json at repo root, no cross-tree content loading):

```
docs/
  astro.config.mjs      # Starlight; base=/rto-invoice-prep/; locales: en (root), hi, mr
  package.json          # astro + @astrojs/starlight only
  tsconfig.json
  pages/                # thin Astro shell Starlight needs
  content/
    docs/
      index.md              → /
      getting-started.md    → /getting-started/
      guide.md              → /guide/
      faq.md                → /faq/
      hi/…, mr/…            → /hi/…, /mr/… (Starlight i18n routing)
  adr/                  # untouched — not in the content collection
  agents/               # untouched — not in the content collection
```

Fallback: if Starlight objects to a root-level `srcDir`, use `docs-site/`
with a glob loader pointing at `../docs` — same URLs either way. Verify
during implementation.

## Pages & URLs

Base path: `/rto-invoice-prep/` (repo Pages URL, no custom domain).
No `/docs/` segment in URLs.

| URL | Page |
|---|---|
| `/` | Home — hero, tagline, Download button, links |
| `/getting-started/` | Install, first run, set up details, first invoice |
| `/guide/` | Day-to-day usage (fields, GST, print/PDF, batch) |
| `/faq/` | FAQ + troubleshooting |
| `/hi/…`, `/mr/…` | Hindi and Marathi mirrors of all four pages |

## Content & i18n

- Audience: end users (people generating RTO/vehicle invoices), plain
  non-technical English.
- English at root, Hindi at `/hi/`, Marathi at `/mr/`, language switcher in
  the header.
- All content (including hi/mr translations) drafted from the codebase;
  translations are machine-drafted and flagged for human review.
- Branding: **"RTO Invoice Prep"** — tagline **"Prepare dealership invoices
  for RTO registration."** (from the app's About modal / package.json).

## Download button

- Windows ships a single NSIS installer; artifact name keeps its version:
  `rto-invoice-prep-Setup-${version}.exe` (unchanged in package.json).
- Site build constructs the direct link from `package.json` at build time:
  `https://github.com/deshmukhmayur/rto-invoice-prep/releases/download/v{version}/rto-invoice-prep-Setup-{version}.exe`
  Button label shows that version (e.g. "Download v0.1.0").
- Releases stay **draft** (releaseType: draft unchanged). The direct link
  404s until the draft is published; the site rebuild on publish fixes it.
- Invariant: tags must keep matching `v{version}` from package.json (the
  `v*`-tag release trigger already implies this). The releases-page link is
  the fallback if they ever diverge.
- Secondary CTA: link to the releases page.

## Deploy workflow

New workflow (e.g. `.github/workflows/docs.yml`), triggers:

- push to `main`, paths-filtered: `docs/**`, `.github/workflows/docs.yml`
- `release: types: [published]` (so the version badge refreshes when a draft
  release is published)
- `workflow_dispatch` (manual)

Runs with Bun (`oven-sh/setup-bun`), builds with Astro, deploys via the
official `actions/deploy-pages` artifact flow (not a `gh-pages` branch).

## App changes (part of this implementation)

- `src/renderer/renderer.ts:16` — the app's "Docs" link changes from
  `…/rto-invoice-prep/docs/` to `…/rto-invoice-prep/guide/` (the `/docs/`
  URL no longer exists).

## Manual step (human only)

First deploy requires enabling GitHub Pages with source **"GitHub Actions"**
in the repo settings.

## Site chrome

- GitHub repo icon in the header
- Light/dark follows the visitor's system
- Footer: "MIT licensed · Made for a single dealership desk" + bug/feature
  request links (issue templates)
