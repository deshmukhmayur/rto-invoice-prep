# 12 - Prototype the empty and error states

Type: prototype (HITL)
Blocked by: 11
Status: resolved

## Question

The UI prototype (ticket 11) settled the design language (Variant D — Native Window, Fluent/Win11 inspector layout) but only exercised its populated path. Prototype the **empty, transitional, and error states** in the same artifact (`prototype/ui-prototype.html`), so the dev can react before the spec is reviewed (ticket 07).

Empty/transitional:

- First launch: no files yet — what the upload block says and looks like before anything has been dropped
- Drag-hover state: the whole-window drop affordance while dragging
- Ingest in progress: per-row placeholder while extraction runs
- All rows removed: back to empty (same as first launch? or subtly different?)
- Refused-only batch: every row failed — what does the export side of the toolbar do?
- Empty log panel / no log file yet
- Output dir not set or unwritable

Error states — the refused rows and runtime failures per ticket 08's detect-and-refuse policy, and what they look like:

- Refused row rendering: the named-field reason inline on the row (missing discount row vs 0.00, broken `Sub − Discount = Taxable` identity, extra line items, unextractable amount, template drift) — severity hierarchy, iconography, copy tone
- Export-time failure: disk full / output dir unwritable / write conflict mid-batch — what happens to completed rows, what does the user retry?
- App-level errors: PDF that crashes the parser, unknown exception — graceful surface, never a silent row
- The log panel's role in errors: what gets written, how the user gets from an error row to its log entry

Use the `prototype` skill; extend or fork `prototype/ui-prototype.html` in the same Variant D language rather than starting a new aesthetic. Decisions here slot into the spec's UX section during the dev's review of ticket 07.
## Comments

### Prototype built, awaiting reaction (agent, 2026-09-24)

Extended `prototype/ui-prototype.html` in place — Variant D (Native Window) now carries a **scenario panel** (top-right, only in variant D) staging every state from this ticket; syntax-checked, figures unchanged. Status: **claimed**, resolving on the dev's reaction.

Staged scenarios:

- **First launch / all rows removed** — centred dashed empty panel: folder glyph, "No invoices yet", three entry routes (drop anywhere / File → Upload Invoice / rail block), plus a "nothing is stored between sessions" line. **Staged identically to first launch on purpose** — the dev should react whether back-to-empty should differ (e.g. a subtler "Batch cleared" variant).
- **Reading files** — "Reading N of M…" determinate bar plus **per-row placeholder entries** (`reading dropped-invoice-1.pdf…` with spinner dot) that become rows as each finishes. Real drop / Upload / File→Upload Invoice all exercise it live.
- **Drag hover** — full-window dashed overlay (also real: drag any file into the window).
- **Every file refused** — export combo reads **"Nothing to export"** (disabled), caret disabled, rail shows a red summary strip under the rows.
- **Output folder unwritable** — picker turns red with ⚠ and "(unwritable)", export button reads "Export blocked", a red banner above the card explains and offers **Pick another folder** (choosing clears the warning).
- **Export failure mid-batch** — click Export: first file gets a green "Saved ✓" rail tag + "Saved." note on its card; second file gets a red "!" rail tag, "Write failed" flag, and a red panel naming the error (disk full) with **Retry this file** (retry simulates success); log records `FAILED` under the OK entry.
- **Parser crash** — new simulated encrypted/damaged PDF: hollow red dot, error panel (gray, severity below refusal's red) with **Open Log** and **Report a bug** actions; log writes an `ERROR` line. Never a silent row.
- **Empty log** — fresh session + log modal open: "Nothing logged yet…" plus the monthly-file/never-deleted reminder.

Open questions for the dev (numbered for reaction rounds):

1. Is first-launch empty state right — copy, size, placement? Should back-to-empty differ at all?
2. Ingest placeholders: is "reading <filename>…" per-row the right weight, or just the bar?
3. Refused-only: is "Nothing to export" (vs "Export 0 files") right? Anything else the export side should do?
4. Unwritable folder: banner + red picker — enough, or should Export stay enabled and fail loudly instead?
5. Export failure: is retry-per-file the right recovery shape? What about the completed rows — any marker needed after the fact?
6. Crash state: gray "error" panel below refusal-red in severity — does the split (refused = red, crash = gray) read right?
7. Does the log empty state + ERROR/FAILED line shapes look right?

### Verdict (dev, 2026-09-24): all staged states accepted as-is

The dev reviewed every scenario in the live prototype (served on :8399) and accepted them without changes. Of the seven open questions:

1. First-launch empty state: accepted as built. Back-to-empty stays **identical to first launch** (no separate "batch cleared" variant).
2. Ingest placeholders: "reading <filename>…" per-row spinner entries accepted.
3. Refused-only: "Nothing to export" (disabled combo + disabled caret) accepted.
4. Unwritable folder: red ⚠ picker + "Export blocked" + recovery banner accepted (export stays disabled; does not fail loudly at click-time).
5. Export failure: per-file Retry with completed rows keeping their "Saved ✓" marker accepted.
6. Crash state: gray error panel below refusal-red accepted (refused = red, crash = gray).
7. Log empty state + ERROR/FAILED line shapes accepted.

Dev-requested polish, applied in the prototype before sign-off: scenario panel collapses (▾/▸ header toggle); drag-hover overlay strengthened to frosted glass (translucent blue + backdrop blur, 📄 icon beside the message).

## Answer

**All empty, transitional, and error states from this ticket are settled in the Variant D design language; the spec's UX section incorporates them as reviewed.** Decisions:

- **Empty (first launch and back-to-empty — same state):** centred dashed panel with folder glyph, "No invoices yet", the three entry routes (drop anywhere · File → Upload Invoice · rail upload block), and the "nothing is stored between sessions" line.
- **Drag hover:** full-window dashed border over a frosted-glass overlay (translucent blue, backdrop blur) with an icon + "Drop PDFs to add them".
- **Ingest:** "Reading N of M…" determinate bar plus one spinner placeholder row per pending file ("reading <filename>…"); rows appear as each finishes.
- **Refused-only batch:** export combo reads **"Nothing to export"** (button + caret disabled); rail shows a red summary strip under the rows ("All N files were refused or could not be read…").
- **Output folder unwritable/not set:** picker renders red with ⚠ and "(unwritable)"; export reads **"Export blocked"** (disabled); a red banner above the card explains and offers **Pick another folder**; picking a writable folder clears it.
- **Export-time failure:** completed rows keep a green **Saved ✓** rail tag and a "Saved." note on the card (originals untouched line unchanged); the failed row gets a red **!** rail tag, **Write failed** flag, and a red panel naming the error with **Retry this file**; retry re-writes only that file; log records `FAILED` beneath the OK entry.
- **Parser crash / app-level error:** hollow red dot in the rail, gray error panel (severity below refusal-red) stating what failed, with **Open Log** and **Report a bug** actions; log writes an `ERROR` line. Never a silent row.
- **Empty log:** "Nothing logged yet…" plus the monthly-file reminder (`rto-invoice-prep-YYYY-MM.log`, never rotated away or auto-deleted).
- **Copy tone:** every failure names the file/field and offers a concrete next action (retry / pick folder / open log / report bug); refusals stay red, crashes gray, successes green — Fluent severity colors throughout.

Prototype capture: `prototype/ui-prototype.html` (variant D + scenario panel, uncommitted on the current branch as with ticket 11).
