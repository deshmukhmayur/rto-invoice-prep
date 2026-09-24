# 07 - Assemble the build-ready spec

Type: task (HITL)
Blocked by: 02, 04, 05, 06, 08, 09, 10, 11, 12, 12
Status: resolved

## Question

Write `.scratch/rto-invoice-fixer/spec.md` from the resolutions of tickets 02, 04, 05, 06, 08, 09, 10, 11 (transformation math with worked example from the samples, stack + PDF technique with rationale, UX flow incl. the settled UI from ticket 11, distribution). The dev reviews it before the map closes.

## Answer

The build-ready spec is written and reviewed: [spec.md](../spec.md). It pins, sourced to its decision tickets:

- **Transformation** (02): "recompute as if the discount were zero", with the sample's worked example to the paisa, the whole-row-empty override, right-alignment via Helvetica metrics at `x = 586.3 − width`, correct regenerated words line, and the verbatim-preserved identity list.
- **Technique** (04): pdf-lib content-stream surgery on the original, with the fail-loud op-pattern validator; PyMuPDF fallback documented.
- **Refusals** (08): all detect-and-refuse cases; single-template lock, no second sample needed.
- **Stack** (03): Electron + pdf.js + pdf-lib; Win10 floor, current Electron line.
- **UX** (05, 11, 12): Variant D Fluent/Win11 inspector — native menu, toolbar, empty/transitional/error states all as-built in the prototype; naming in the save dialog (`<original>-RTO.pdf`), zip default `rto-invoices-YYYY-MM-DD.zip`, monthly never-deleted logs, invisible provenance via added custom metadata.
- **Name** (10): RTO Invoice Prep, one name everywhere.
- **Distribution** (06): unsigned one-click NSIS from CI → draft GitHub Release; electron-updater on a publicly-readable repo; SmartScreen/Smart-App-Control caveats.
- Plus a new **Acceptance criteria** section (7 criteria: paisa-exact transformation, byte-identical untouched content, refusal demonstrations, validator failure, batch export, state behaviours, install/update/theme).

Dev reviewed and approved (2026-09-24); map closes.

## Comments

- Claimed by wayfinder session, 2026-09-24. Draft written to [spec.md](../spec.md) — all eight input tickets folded in (transformation math + worked example from the sample, surgery technique + validator, detect-and-refuse rules, stack, full UX from ticket 11 incl. the Variant D design language and the naming-field supersession, distribution, plus acceptance criteria). Awaiting dev review before resolving and closing the map.
- Ticket 12 (empty/error states) incorporated into the spec's UX section and acceptance criteria at the dev's request; blockers updated.
- Resolved by wayfinder session, 2026-09-24: dev approved the spec. Map complete — the destination is reached.
- Amendment (dev question on auto-updates, 2026-09-24): the update-feed repo identity was left as "public repo, or a separate public releases-only repo" — now **pinned in the spec (§8) to a separate public releases-only repo with explicit owner/repo in the publish config**. Reason: the code repo stays private because it holds real invoice samples with customer PII (`.scratch/samples/`); and the feed repo is baked into the installer at build time, so the decision is irreversible after first install.
- Amendment 2 (dev, 2026-09-24): dev is making the source repo public — the update feed is **this repo itself** (explicit owner/repo in publish config), superseding the releases-only-repo pin. Spec §8 updated; the hard condition stays: `.scratch/samples/` (customer PII) must be removed from the repo and ignored **before** it goes public.
