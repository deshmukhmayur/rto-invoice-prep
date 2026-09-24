# 05 - Spec the UX flow

Type: grilling (HITL)
Status: resolved

## Question

Pin the v1 interaction: batch upload (file picker + drag-drop of multiple PDFs), per-file extraction preview showing the recalculated numbers before export (so a wrong extraction is caught), export of the fixed PDFs (single file and/or zip), output naming, and behaviour when a PDF can't be parsed. No editing UI, no storage, stateless. Consult the `grilling` and `domain-modeling` skills.

## Answer

Pinned v1 interaction (grilling session, 2026-09-23). Flow: open app → drop PDFs → review rows → export → done. Stateless; no edit UI, no history, no settings screen.

**Input**: file picker + drag-drop of multiple PDFs.

**Preview list** (one compact row per file):

- Old → new numbers for every changed figure: taxable value, CGST, SGST, ex-showroom price, round-off, grand total.
- Rendered thumbnail of the invoice so the clerk confirms the right vehicle/chassis at a glance.
- Prefilled default output name: `<original>-RTO.pdf` (suffix `-RTO`; not `-fixed`), editable per row.
- Per-row ✕ remove for **any** file — valid or refused — so the user can ignore/unwanted files out of the batch.

**Refusals** (ticket 08's detect-and-refuse cases): the row shows the error with the named field; removing it from the batch lets the rest export. Refusals are still logged.

**Export**:

- Clean files export as a batch with one click; no per-file confirmation ceremony.
- Individual per-file download buttons exist alongside Export-all.
- Individual export and Download-all-as-zip use the same (possibly user-renamed) per-file names.
- Save dialog on export: output directory field on the review/export screen defaults to the user's Downloads path; per-file name rows editable; zip default name `rto-invoices-YYYY-MM-DD.zip` (editable).

**Log**: global append-only `rto-invoice-prep.log` in the user's app-data directory, accessible manually and displayed in-app in a preview panel/popout window (not just file-open). Dated section per batch: timestamp, input → extracted numbers → recalculated numbers → output path; refusals with reasons.

**Provenance** (settled earlier on this ticket, unchanged): no visible stamp on the page; original PDF metadata preserved, new custom metadata fields added (tool name, version, processing timestamp, modification description); originals never overwritten.

## Comments

### Settled input: provenance marking (dev, charting-adjacent session)

Transparency is for the dev/dealership, not for RTO — no visible stamp on the page (would diverge from the accepted manual-edit baseline and risks rejection). Three mechanisms, all invisible on the page:

1. **PDF metadata**: keep the original Producer and all original fields untouched; only *add* new custom fields: tool name, tool version, processing timestamp, and a modification description (e.g. "discount removal for RTO compliance").
2. **Never overwrite**: originals stay untouched; output to a separate folder or `<name>-fixed.pdf`.
3. **Per-batch processing log**: input → extracted numbers → recalculated numbers → output, timestamped; the audit trail if anything is ever questioned.

