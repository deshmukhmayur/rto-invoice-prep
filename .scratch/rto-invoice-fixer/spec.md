# Spec: RTO Invoice Prep

*Prepare dealership invoices for RTO registration.*

Build-ready spec for a standalone Windows app that removes a two-wheeler dealership invoice's discount line and recomputes the totals as if the discount were zero, producing the invoice form RTO registration expects. It reproduces — in acceptance and mechanics — the manual PDF edit the dealership has used for years, which RTO has long accepted.

Provenance of every decision: the map at [.scratch/rto-invoice-fixer/map.md](map.md); decision tickets under `issues/`, research notes under `research/`, UI prototype at [prototype/ui-prototype.html](prototype/ui-prototype.html) (Variant D, incl. the empty/error-state scenarios from ticket 12).

## 1. Domain and goal

Indian two-wheeler dealership invoicing. The OEM portal's invoice carries a discount line: Sub Total − Discount = Taxable Value; CGST + SGST (9% each) on the taxable value; Ex Showroom Price = Net Amount = Grand Total = Taxable + CGST + SGST; Round Off yields the final total.

RTO registration requires the invoice at the vehicle's **full (undiscounted) price** — road tax is a fixed percentage of the manufacturer's official ex-showroom price, so the baseline is pre-discount. Discounts legitimately apply to the customer's on-road bill, not the registration baseline.

**Baseline**: the dealership has long hand-edited these PDFs and RTO accepts them. The tool targets reproducing the manual edit's *output and acceptance* — not the OEM portal's record, and not the manual edit's typos.

## 2. The transformation (validated against real samples)

Samples: `.scratch/samples/original.pdf` / `modified.pdf` (real invoice pair; Oracle BI Publisher output, 2 pages, letter). Research: [02-analyse-sample-diff.md](research/02-analyse-sample-diff.md).

The edit is exactly **"recompute as if the discount were zero"**. Given extracted Sub Total `S`, Discount `D`, and Taxable `T₀` (all parsed to paisa, Indian digit grouping `55,872.88`):

1. **Discount row removed**: the `Discount` label and its value `D` are emptied (text strings become empty; operators and ruling lines untouched; rows below keep their absolute coordinates). *User override (2026-09-23): the whole row is emptied — label and value — unlike the sample edit, which kept the label. No layout shift.*
2. `Taxable = S`
3. `CGST = SGST = round2(0.09 × Taxable)`; the labels' embedded base text is rewritten too (`CGST on <taxable>`).
4. `Ex Showroom Price = Net Amount = Grand Total = Taxable + CGST + SGST`
5. `Round Off = round(Grand Total) − Grand Total`; the final "Grand Total (after Round Off)" is the rounded value.
6. **Rupees-in-words regenerated correctly** from the final total (the hand edit's line was garbled; the tool emits a properly spelled line).

**Worked example** (the real sample, verified to the paisa):

| Field | Original | Prepared |
|---|---|---|
| Discount | `1,780.00` | *(row emptied)* |
| Taxable Value | `54,092.88` | `55,872.88` |
| CGST on … / amount | `CGST on 54,092.88` / `4,868.36` | `CGST on 55,872.88` / `5,028.56` |
| SGST on … / amount | `SGST on 54,092.88` / `4,868.36` | `SGST on 55,872.88` / `5,028.56` |
| Ex Showroom Price | `63,829.60` | `65,930.00` |
| Net Amount | `63,829.60` | `65,930.00` |
| Grand Total | `63,829.60` | `65,930.00` |
| Round Off | `0.40` | `0.00` |
| Grand Total after Round Off | `63,830.00` | `65,930.00` |
| Rupees in words | `Rupees Sixty Three Thousand Eight Hundred Thirty Only` | `Rupees Sixty Five Thousand Nine Hundred Thirty Only` |

**Preserved verbatim** (ticket 09, user-confirmed): invoice number, dates, chassis/engine/VIN, dealer and customer blocks, HSN, all of page 2, and every image (the only QR is the Hero app-download promo — the invoice carries no machine-readable price data, so nothing machine-readable contradicts the raised totals).

## 3. PDF technique

In-place **content-stream surgery on the original PDF** — validated by direct inspection of both samples ([04-choose-pdf-technique.md](research/04-choose-pdf-technique.md)):

- Page-1 text is all simple absolute-position `BT … 1 0 0 1 x y Tm (string) Tj … ET` ops in non-embedded standard-14 fonts (Helvetica/Helvetica-Bold, 8–9pt). Amounts are located by `Tm` coordinates and label text, **never by string match alone** (e.g. `54,092.88` appears 3×).
- **Edit**: decompress the stream; empty the discount label + value string literals (pure string substitution; `Tf`/`Tm` context preserved); rewrite each affected amount at `x = 586.3 − width(newString)` — right-aligned to the sample's known right edge (586.3pt), widths from pdf-lib's standard Helvetica metrics. Validated: both the original's draws and the manual edit's rewritten placements match `x = rightEdge − width` (±0.5pt). Right-alignment holds for any amount width, including thousands-boundary crossings.
- Everything else — images, ruling lines, fonts, page 2, original metadata — stays as untouched bytes. Re-compress and save.
- pdf-lib does this via `PDFRawStream` decode/replace; pdf.js previews the result.
- **Fallback stack** (documented, not required): Python + PyMuPDF + PyInstaller — same surgery, less ceremony; AGPL noted.

**Op-pattern validator — fail loudly.** Before editing, the tool must match the expected structure exactly: the totals block's row set and order (Sub Total → Discount → Taxable Value → CGST on X → SGST on X → Ex Showroom Price → Net Amount → Grand Total → Round Off → Grand Total after Round Off), labels present at sane coordinates, non-embedded standard fonts, 2 pages. Any drift (TJ arrays, subset fonts, moved rows, missing labels) → refuse. Never guess, never emit partial output.

## 4. Extraction and refusals (detect-and-refuse everywhere)

The tool never guesses and never emits degraded output (ticket 08):

| Situation | Behaviour |
|---|---|
| No Discount row found | Refuse: "no Discount row found" |
| Discount is `0.00` | Refuse: distinct message ("Discount is 0.00") |
| Extra line items in the totals block (insurance, road tax, TCS, accessories) or broken `round2(Sub − Discount) = Taxable` identity | Refuse, showing the observed numbers |
| Multiple discount rows | Refuse (exactly one row labelled `Discount` required) |
| Any template variation (labels, layout, page count ≠ 2) or validator failure | Refuse; no fuzzy/best-effort matching |
| Missing/unextractable amounts | Refuse, naming the field ("Taxable Value amount not found") |

The extraction rules are written as "validated against this one template; refuse otherwise". A second sample pair is not needed before build (ticket 08); broadening to variants happens only when a real variant sample exists and the spec is extended.

## 5. Stack

**Electron + pdf.js + pdf-lib**, packaged with electron-builder (ticket 03; rationale in [research/03-choose-app-stack.md](research/03-choose-app-stack.md)):

- Electron is the only option that officially builds a Windows installer from Linux (the dev runs Linux; CI provides the Windows build anyway).
- pdf.js (Apache-2.0) extracts text with per-run position matrices; pdf-lib (MIT) handles the stream surgery — pure JS, no native modules, no license entanglement. PyMuPDF/MuPDF.js are strongest but AGPL — avoided.
- **Language and toolchain** (dev amendment, 2026-09-24): **TypeScript** throughout (main + renderer); **Bun** as the package manager and script runner (never npm). CI and electron-builder hooks run via bun; the packaged app itself is unaffected (Electron runs the compiled output).
- Electron's size/RAM cost is irrelevant for one desktop user.
- **Platform floor: Windows 10**; current Electron line (Win7/8.1 would pin Electron 22 — an EOL Chromium — and is explicitly not supported). This is a day-one fork decision, not a bolt-on.

## 6. UX (tickets 05, 11 + 12; 14 + 1 prototype reaction rounds)

Flow: **open app → drop PDFs → review rows → export → done.** Stateless: no edit UI, no history beyond the log, no settings screen. UI prototype: [prototype/ui-prototype.html](prototype/ui-prototype.html) (Variant D).

### Design language — "The Native Window" (Fluent / Win11)

- Segoe UI; mica-grey window `#F3F3F3`; white cards, 1px `#E5E5E5` borders; 8px card radius / 4px control radius; accent `#005FB8`; Fluent success `#0F7B0F` / error `#C42B1C`; amber highlight on new values.
- **Dark theme via `prefers-color-scheme`, no picker** (`nativeTheme.themeSource = "system"`): `#202020` window, `#2B2B2B` cards, `#4CC2FF` dark accent.
- **Default OS titlebar** — no custom titlebar; the app sets the window title "RTO Invoice Prep v0.1". All app controls live in plain DOM (portable if a non-Windows platform ever matters).
- **Native application menu** (`Menu.setApplicationMenu`):
  - **File**: Upload Invoice (Ctrl+O), New Window (Ctrl+Shift+N), Quit (Ctrl+Q)
  - **View**: Zoom in/out/reset (Ctrl +/−/0), Developer Tools (F12)
  - **Help**: User guide — Open Log · Report a bug — Check for updates · About
  - Accelerators, Alt menubar traversal and mnemonics are Electron-native. DevTools in a shipped build is acceptable for this single-user local tool (no bundled secrets) — stated deliberately.

### Toolbar

Menus left; right side: **output directory** as a folder-picker button (native `openDirectory` dialog, defaults to Downloads) + the **export combo**: primary "Export N files" writes the individual PDFs; ▾ dropdown offers **"Export as Zip"** (save dialog opens with the name prefilled — default `rto-invoices-YYYY-MM-DD.zip`; no rename UI beyond the dialog).

### Upload / ingest

- Full-width dashed **Upload block button** ("Upload invoices / or drop PDFs anywhere in this window") + **whole-window drag-and-drop** (full-window overlay while dragging).
- **Drag hover**: full-window dashed border over a **frosted-glass overlay** (translucent blue, backdrop blur) with an icon + "Drop PDFs to add them".
- **Ingest progress**: "Reading N of M…" with a determinate bar, plus **one spinner placeholder row per pending file** ("reading `<filename>`…"); rows appear as each finishes.

### Empty state (first launch and back-to-empty — same state)

- Centred dashed panel with folder glyph, "No invoices yet", the three entry routes (**drop anywhere · File → Upload Invoice · rail upload block**), and a "nothing is stored between sessions" line. Returning to empty after removing all rows is deliberately identical to first launch — no separate "batch cleared" variant.

### Failure states (severity colors: refusal red, crash gray, success green)

Every failure names the file/field and offers a concrete next action (retry / pick folder / open log / report bug):

- **Refused-only batch**: export combo reads **"Nothing to export"** (button + caret disabled); rail shows a red summary strip under the rows ("All N files were refused or could not be read…").
- **Output folder not set or unwritable**: folder picker renders red with ⚠ and "(unwritable)"; export reads **"Export blocked"** (disabled); a red banner above the card explains and offers **Pick another folder** — picking a writable folder clears it. (Does not fail loudly at click-time; the block is surfaced before export.)
- **Export-time failure mid-batch**: completed rows keep a green **Saved ✓** rail tag and a "Saved." note on their cards (originals-untouched line unchanged); the failed row gets a red **!** rail tag, **Write failed** flag, and a red panel naming the error (disk full, write conflict) with **Retry this file** — retry re-writes only that file; the log records `FAILED` beneath the OK entry.
- **Parser crash / app-level error**: hollow red dot in the rail, **gray error panel** (severity below refusal-red) stating what failed, with **Open Log** and **Report a bug** actions; log writes an `ERROR` line. Never a silent row.

### Review rail and preview cards

- Left rail: one compact row per file — pass/fail dot, **✕ remove on any row** (valid or refused).
- Card (Fluent, 8px radius): filename + **download icon** top-right. **No output-filename input** — naming happens in the save dialog, default `<original>-RTO.pdf` prefilled. *(Supersedes ticket 05's editable per-row name field.)*
- **Details grid**: Invoice no., Customer, Invoice date, Model, Chassis no., Engine no.; unparsable fields render `~unreadable~`; nothing extractable → "Invoice details could not be extracted." Shown on refused cards too.
- **Totals facsimile**: Sub Total; Discount row struck with "✕ removed"; old struck → new amber-highlighted for Taxable / CGST / SGST / Ex-showroom / Round off / Grand total; **Amount in words** as a row (old → new).
- **Refused cards**: failing rows marked ("✕ does not add up" / "✕ field not found"), red annotation with the named-field refusal reason; never exportable.

### Modals (centred Fluent dialog, dimmed backdrop; ✕ / backdrop / Esc close)

- **Log — this session**: OK lines (taxable/total → wrote path), REFUSED / FAILED lines in red, ERROR lines for crashes. Empty state: "Nothing logged yet…" plus the monthly-file reminder. Buttons: **Open Folder** (`shell.openPath` on the logs dir) and **Download** (save-dialog copy) icon buttons.
- **User guide**: what it does / how to use / where files go; "View full documentation" → GitHub Pages docs.
- **About**: app icon, name, version line with inline **Check for updates** (`autoUpdater.checkForUpdates()`), tagline, one-paragraph purpose, runtime versions (`process.versions`), links row **Website · Source · Report a bug · Feature request**. All external URLs live in one `APP_LINKS` constant (GitHub Pages site/docs, repo, issue-template URLs — TODOs to fill when the repo/pages exist).

### Files, naming, provenance

- **Originals never overwritten.** Exports write new files named `<original>-RTO.pdf` (individual and in-zip names identical).
- Original PDF metadata preserved; only **added** custom metadata: tool name, version, processing timestamp, modification description ("discount removal for RTO compliance"). No visible stamp on the page — the output must look like the accepted manual edit.
- **Log**: global append-only monthly files `%APPDATA%\rto-invoice-prep\logs\rto-invoice-prep-YYYY-MM.log` (per batch: timestamp, input → extracted → recalculated → output path; refusals with reasons). **The tool never rotates away or auto-deletes logs** — the log is the audit trail; deletion is the user's manual choice (~100–200 KB/year at one desk).

## 7. Name and identity

- **Name: "RTO Invoice Prep"** — one name everywhere: window title, PDF metadata, log; `RTOInvoicePrep` exe/NSIS product name; kebab-case `rto-invoice-prep` for repo/release assets.
- Tagline *"Prepare dealership invoices for RTO registration"* on installer and About only.

## 8. Distribution

(ticket 06; [research/06-distribution-approach.md](research/06-distribution-approach.md))

- **One-click NSIS installer** built in CI (GitHub Actions, `windows-latest`, on tag push → draft GitHub Release): `oneClick: true`, `perMachine: false` (per-user, no UAC on install or updates). The appId must never change.
- **No code signing** (unobtainable for an unpaid project: Azure Trusted Signing is US/Canada individuals only; OV $150–300/yr + HSM). Unsigned UX: SmartScreen "More info" → "Run anyway", one-time. **Windows 11 Smart App Control (if on) blocks unsigned with no override** — warn the user.
- **electron-updater** with the GitHub Releases provider, installed silently on quit. **The update feed is this repo itself** (dev decision, 2026-09-24: the source repo is public), with `owner`/`repo` set explicitly in the publish config so it's baked in deterministically. **Before the repo goes public, remove `.scratch/samples/` from the repo and ignore it** — the samples are real invoices with customer PII. The feed repo is baked into the installer at build time (`app-update.yml`), so changing it later is effectively irreversible — do not call `setFeedURL`. Draft releases are invisible to the updater until promoted.
- Portable .exe is not the primary artifact (no auto-update).

## 9. Out of scope

- Building/shipping the app (separate effort, once this spec lands).
- Web deployment; multi-user/server features; verification against other invoice variants (deferred until a real variant sample is obtainable — detect-and-refuse makes v1 safe).
- Replicating the manual edit's typos; matching the OEM portal's record (acceptance baseline is the manual edit).

## 10. Acceptance criteria

1. Given `.scratch/samples/original.pdf`, the tool produces numbers matching §2's worked example to the paisa, with the discount row emptied, rewritten amounts right-aligned to the untouched rows, and words line regenerated correctly.
2. Output opens in pdf.js looking identical to the original except the totals block; image objects, ruling lines, page 2, and original metadata are byte-identical.
3. Every §4 refusal case is demonstrated with a synthetic or hand-made variant and shows the named-field message; nothing partial is ever written.
4. The op-pattern validator fails loudly on a deliberately mutated stream (TJ array / moved row / subset font).
5. Batch of N files: preview rows with old→new and pass/fail; Export-all writes N files + optional zip named `rto-invoices-YYYY-MM-DD.zip`; ✕ removes any row; refusals logged.
6. The empty, transitional, and error states of §6 (empty panel, drag hover, ingest placeholders, refused-only batch, unwritable folder, mid-batch failure with per-file retry, parser-crash panel, empty log) behave as specced, each naming the file/field and offering its next action; a parser crash is never a silent row.
7. Installs on Windows 10 via the unsigned NSIS one-click installer, updates silently on quit against a draft-promoted GitHub Release, and follows the system light/dark theme.
