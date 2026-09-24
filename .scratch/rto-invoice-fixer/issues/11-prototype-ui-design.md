# 11 - Prototype the UI design language and layout

Type: prototype (HITL)
Blocked by:
Status: resolved

## Question

Raise the fidelity of the UX discussion with a cheap, rough, concrete artifact: a stub of the app's screens (batch upload, per-file extraction/recalculation preview, export) that the dev and the dealership employee can react to. Use the `prototype` skill to build it. It should pin:

- The overall design language (aesthetic direction, typography, layout conventions — not templated default Electron gray)
- The three-screen flow's actual arrangement: batch upload with drag-drop, per-file preview showing extracted → recalculated numbers side by side with pass/fail flags, export controls
- How error states surface (unparseable PDF, missing fields, discount not found)

Note: the stack is settled (Electron), so a plain HTML/CSS stub or a minimal Electron window both work; throwaway is fine. Output feeds the spec's UX section (ticket 07) alongside the flow decisions in ticket 05.

## Comments

### Prototype built, awaiting reaction (agent, 2026-09-23)

Artifact: `.scratch/rto-invoice-fixer/prototype/ui-prototype.html` — self-contained, open in any browser (or serve the repo and append `?variant=A|B|C`; the floating bar and ←/→ arrow keys switch variants). Throwaway; no persistence.

Three structurally different directions, all driven by the real invoice pair (`.scratch/samples/`, figures to the paisa) plus simulated files covering every UI state:

- **A (The Register)** — pale-green feint-ruled ledger day-book; typed folio rows (Courier figures, Georgia prose), serial numbers, old values struck, refusals as rotated double-ring rubber stamps; output dir + export in a double-rule footer; the log opens as a "carbon copy" slip.
- **B (The Counter)** — warm brown billing-counter surface; each file a punched receipt strip (figures right-aligned in mono, marigold action buttons); sticky till on the right with output dir / zip name / Export; per-file export is "Tear off ↓".
- **C (The Inspector)** — neutral PDF-viewer workspace (app chrome, file rail with pass/fail dots); signature is an annotated facsimile of the invoice's totals block — Discount row struck with "✕ row emptied", old amounts struck, new amounts amber-highlighted, margin note listing what was recomputed and what stayed untouched.

Error states in all three: no-discount vs 0.00 discount distinguished, identity mismatch with observed numbers, unextractable field named (ticket 08's messages), plus a damaged-scan refusal; per-row ✕ works on valid and refused rows; export buttons show what *would* be written without writing.

Status: **claimed** — the ticket resolves when the dev + dealership employee pick a direction (or mix, e.g. "B's receipts, C's facsimile"), then the answer is recorded and the artifact captured to a throwaway branch.

### Reaction round 1 (dev, 2026-09-23): C wins, with one change

The dev likes **C (The Inspector)** with the individual preview screens. Changes requested and applied across feedback rounds:

1. Output directory moved from the bottom line into the top chrome, beside the export controls; the bottom line keeps only the "saves alongside the originals — never overwritten" note.
2. Export and Zip merged into one combo button: clicking **Export N files** writes the individual PDFs to the output directory; the ▾ dropdown offers zip. The zip option no longer names the zip (the save dialog opens with the name prefilled), and "Change zip name…" was removed.
3. Discount row wording: "row emptied" → "removed" everywhere.
4. New **D (The Native Window)** — identical layout to C, dressed in Microsoft Fluent (Win11): Segoe UI, mica-grey surfaces, custom titlebar with caption buttons, command bar, accent-blue (#005FB8) combo split button, 8px rounded cards, Fluent success/error colors (green #0F7B0F / red #C42B1C), Fluent highlight yellow on the new values. Intent: the app should feel Windows-native rather than a custom Electron/web UI.

Still awaiting confirmation of the final pick (C vs D).

### Reaction round 3 (dev, 2026-09-23): zip wording + titlebar question

- Zip dropdown simplified to a single option, **"Export as Zip"**, no subtext (save dialog will carry the zip name). Applied.
- Output directory + export combo **moved into the titlebar** in D (mocked in the prototype): icon + title left, output dir input + combo right of it, caption buttons far right; titlebar grows to 44px.
- **Electron support (researched, agent):** yes, supported two ways — (a) `titleBarStyle: 'hidden'` + `titleBarOverlay` (Window Controls Overlay): OS-drawn native caption buttons, your HTML fills the rest of the titlebar; works on Windows 10+ and keeps Win11 Snap layouts; interactive controls must sit inside the titlebar area (drag region excludes them automatically). (b) `frame: false`: fully custom titlebar, you wire min/max/close yourself and manage `-webkit-app-region: drag`/`no-drag`; works anywhere Electron runs.
- **Older Windows:** Electron 23+ does not run on Windows 7/8/8.1 at all — support ended with Electron 22 (Chromium 108, EOL, unpatched). `titleBarOverlay` needs Windows 10+; on 7/8/8.1 you'd fall back to `frame: false` with a fully drawn titlebar — functional, but a Fluent-styled bar on Win7's Aero looks foreign, and on Win10 the Win11 styling (rounded corners, mica) reads slightly newer than native. **Open question for the spec: what is the minimum Windows version?** It decides the Electron pin (22 vs current) and the titlebar mechanism. Not answerable by the prototype — needs to be asked of the dealership (what OS does the one machine run?).
- UX caveat noted: an editable input inside a titlebar is unusual for native apps (drag region must exclude it); the command-bar placement (previous round, Explorer-style) is the more conventional pattern. Both are cheap to switch between in the real app.

### Reaction round 4 (dev, 2026-09-23): minimum Windows version

- Dev doesn't know the dealership machine's OS; **Windows 10 is an acceptable floor**. Verified against Electron's release docs: Electron 22 was the last line to run on Win7/8/8.1 (extended support ended 2023-10-10); Electron 23+ is Win10+ only.
- **Difficulty of adding 7/8.1 later (agent assessment): code is easy, toolchain is not.** The app's own surface (file dialogs, fs over IPC, pdf.js/pdf-lib, NSIS installer) all work on Electron 22's Chromium 108; the only Win10+ dependency in this design is `titleBarOverlay` (fallback: `frame: false` custom titlebar). But retrofitting later forces one of two bad paths: (a) downgrade the whole app to Electron 22 — a migration across many breaking Electron majors *and* a permanent freeze on a Chromium with no security fixes since Oct 2023, unacceptable for a renderer that processes untrusted PDFs; or (b) maintain two Electron lines in parallel — double CI/testing for a one-person unpaid project. So Win7/8.1 support is effectively a **day-one fork decision** (Electron 22 everywhere vs current Electron + Win10 floor), not a bolt-on.
- Cheapest de-risk: have the dealership employee run `winver` (or check when next on site). Win7 died Jan 2020; if she really is on 7, upgrading that one machine is likely cheaper than freezing the toolchain.
- Candidate map ticket when 11 resolves: "Pin minimum Windows version (Win10 assumed) + Electron strategy (current Electron, titleBarOverlay with frame:false awareness)".

### Reaction round 5 (dev, 2026-09-23): Win10 floor locked; toolbar over titlebar fields

- **Minimum Windows version decided: Windows 10 floor.** Win7/8.1 support explicitly not carried forward; the app builds on a current Electron line. Resolves the candidate map question above (no separate ticket needed unless the spec session wants it stated in ticket 06's terms).
- **Titlebar fields rolled back** to the round-2 layout: slim titlebar (icon, app name, native caption buttons) + a **toolbar** below carrying the output directory and the Export/"Export as Zip" combo. Rationale: keeps the window chrome standard and the controls in ordinary DOM, which ports cleanly if a non-Windows platform ever matters; avoids titlebar drag-region edge cases around interactive inputs. In Electron this means a standard frame or `titleBarOverlay` for the caption buttons — both fine on Win10+. Applied to D in the prototype.

### Reaction round 6+7 (dev, 2026-09-23): toolbar menus, directory picker, no custom titlebar

D's toolbar reshaped — **menus left, output/export right, no custom titlebar**:

- **Left group**: `Log` (opens a Fluent drawer showing `rto-invoice-prep.log` — OK lines with taxable/total/wrote paths, REFUSED lines in red), `Help` (flyout: what the tool does, how to use it, version, link to open the log), `☰` (View menu: New window Ctrl+Shift+N; Zoom in Ctrl +, Zoom out Ctrl −, Reset zoom Ctrl 0; Reload Ctrl R; Toggle Developer Tools F12 — with right-aligned accelerators like a native menu).
- **Right group**: output directory is now a **directory selector** button (folder icon + current path) that opens the native folder picker (`dialog.showOpenDialog` with `openDirectory`), not a text field; export combo beside it.
- **No custom titlebar**: the prototype renders no titlebar at all; the real app uses the OS one (plain frame, or `titleBarOverlay` on Win10+/Win11 for Snap layouts).
- **Electron facts (agent, for ticket 07):** all menu actions are standard Electron — `webContents.zoomLevel` (+/−/0 steps), `new BrowserWindow()`, `webContents.openDevTools()`, `dialog.showOpenDialog({properties:["openDirectory"]})`; accelerators via menu Accelerator or before-input-event. DevTools in a shipped build is acceptable for a single-user local tool (no bundled secrets) but the spec should state it explicitly.
- All flyouts are mutually exclusive and close on outside click (a click on another toolbar action both closes the open menu and runs the action).

### Reaction round 8 (dev, 2026-09-23): OS titlebar, sane menus, modals, Download rename

- **Window chrome**: default OS titlebar carrying the tool name and version — the app sets the BrowserWindow title ("RTO Invoice Prep v0.1"); the app window renders no custom titlebar at all.
- **☰ menu restructured into sane groups**: **Window** (New window), **View** (Zoom in / Zoom out / Reset zoom), **Developer** (Reload, Toggle Developer Tools), **Help** (Open Help, Open the log, About RTO Invoice Prep) — group headers inside the flyout.
- **Log, Help and About are modals** (centred Fluent dialog over a dimmed backdrop; ✕ / backdrop / Escape close). Log body: the batch's `rto-invoice-prep.log` content (OK entries with taxable/total/wrote paths; REFUSED entries in red). Help body: what the tool does, how to use it, where files go. About: name + version, tagline, "stateless, single desk" line; the real app shows Electron/Chromium/Node versions via `process.versions`.
- **Per-file button renamed "Save" → "Download"** (with tooltip "Download the prepared PDF"), since "Save" was ambiguous between exporting the file and saving the edited filename. Batch button stays "Export N files"; both open a save dialog.
- Verified in the prototype: Log modal, Download button, grouped menu all render and behave (menu exclusivity, outside-click, Escape).

### Reaction round 9 (dev, 2026-09-23): proper File/View/Help menubar

The toolbar's left group is now a classic **menubar** — `File`, `View`, `Help` — replacing the Log/Help buttons + ☰ grab-bag:

- **File**: New Window (Ctrl+Shift+N), Upload Invoice (Ctrl+O), Quit (Ctrl+Q). Upload Invoice is the app's primary entry point (native file picker for invoice PDFs); in the prototype it adds the next simulated sample.
- **View**: Zoom in (Ctrl +), Zoom out (Ctrl −), Reset zoom (Ctrl 0), Developer Tools (F12). Reload was dropped from the user-facing menu.
- **Help**: Open Help, Open Log, About RTO Invoice Prep (each opens its modal).
- One menu open at a time; outside click, Esc, or picking an item closes. In the real app this maps to Electron's native application menu (`Menu.setApplicationMenu`) rendered under the default OS titlebar — the HTML menubar here stands in for it; roles/accelerators come for free.

### Reaction round 10 (dev, 2026-09-23): renames, updates check, About polish

- "Open Help" renamed **"User guide"** (modal title follows).
- **Check for updates** lives in the **Help** menu (Windows convention — VS Code, Chrome, Notepad++ all put it there), with a "Check for updates" ghost button inside the About box as well. Real app: `autoUpdater.checkForUpdates()` against the GitHub Releases feed from ticket 06.
- **About modal polished**: app icon (blue rounded square), name + version, tagline, one-paragraph purpose ("single dealership desk; stateless; originals never overwritten; every batch logged"), a runtime block (Electron/Chromium/Node via `process.versions`), and the update-check button.

### Reaction round 11 (dev, 2026-09-23): report a bug, preview rework, details section

- **Report a bug** added to the **Help** menu and as a button in the About box; points at the repo's GitHub bug-report issue template (URL to be provided by the dev). About links row: **Website · Source · Feature request** (feature request chosen over generic "feedback"; also a GitHub issue template, URL later). All open as external links in the real app.
- **Preview card reworked**: the output-filename input field is **removed** — naming happens in the save dialog (default `<original>-RTO.pdf` prefilled), which supersedes ticket 05's editable-per-row field; the per-file **Download** button became a **download icon in the card's top-right corner**; the **"Recalculated" chip was dropped** (dev agreed it's unneeded — status lives in the rail's pass/fail dots, and refusals carry their own red annotation).
- **Details section added above the totals facsimile**: a compact grid of parsed invoice metadata — Invoice no., Invoice date, Customer, Model, Chassis no., Engine no. (s1799's values are the real ones from the sample). Shown on refused cards too (metadata extraction still works when the totals block fails); when nothing is extractable (damaged scan) it says so.
- **About card lost its header row** (redundant with the icon+name body); close ✕ now floats in the corner. The runtime line is plain text, not a code-block-style box.
- **Log modal gained a "Download log" button** (save dialog for a copy of `rto-invoice-prep.log`) so bugs can be reported with the log attached.

### Reaction round 12 (dev, 2026-09-23): About links, inline update check, note removed

- **Report a bug is now a link** in the About links row (was a ghost button); links rearranged: **Website · Source · Report a bug · Feature request**.
- **Check for updates moved next to the tool name + version** — rendered as a quiet text link on the version line ("v0.1 · Check for updates"), not a tacked-on button. The Help menu keeps its "Check for updates" item too.
- **"Check before export" note removed from the preview card.** Decision (dev asked, agent recommended): the note was doing three jobs — (1) the "recomputed as if the discount were zero" explainer is onboarding content that belongs in the user guide (Help modal already covers it); (2) the identity-fields sentence is redundant with the details grid; (3) the amount-in-words is data, not a note — it is now a **row in the totals facsimile** (old struck → new, like every other figure). The card is now: header (filename + download icon) → details grid → facsimile (including words row). The refused file's red annotation stays — it is contextual and actionable, not boilerplate.

### Reaction round 13 (dev, 2026-09-23): upload flow, docs links, dark theme

- **Upload block button replaces the drag-drop box** in the left rail: a full-width dashed block button ("Upload invoices / or drop PDFs anywhere in this window"). The **entire window accepts drag-and-drop** — dropping PDFs anywhere shows a full-window dashed overlay ("Drop PDFs to add them") and ingests on drop. Real app: one HTML5 drop handler on the window + `dialog.showOpenDialog` for the button.
- **Ingest progress**: when files are added (button, File → Upload Invoice, or drop), the rail shows "Reading N of M…" with a determinate progress bar until each PDF is extracted; rows appear as they finish. Real app: per-file async parse → progress events over IPC.
- **User guide modal** gained a **"View full documentation"** link pointing at the GitHub Pages docs; **About's Website** points at the GitHub Pages site; Source → repo; Report a bug / Feature request → the repo's GitHub issue-template URLs (dev to supply final URLs). All links live in one `APP_LINKS` constant at the top of the renderer and open via `shell.openExternal` — one place to swap TODOs when the repo/pages exist.
- **Dark theme via system setting** (no picker in v1): variant D follows `prefers-color-scheme` — dark surfaces (#202020 window, #2B2B2B cards), Fluent dark palette, accent #4CC2FF for dark-mode links/progress, dimmed strikethroughs, dark annotation panels. The real Electron app mirrors this with `nativeTheme.themeSource = 'system'`.
- **Log modal's Download log button styled** properly (bordered surface button with download icon; was an unstyled ghost). **Details grid**: Customer before Invoice date; unparsable metadata shows `~unreadable~` in muted gray instead of "undefined"; About modal re-spaced (48px icon, divider above links).

### Reaction round 14 (dev, 2026-09-23): log scope + stored-file management

- The in-app **log window shows the current session only** (title now says "Log — this session"); it opens with a save-dialog "Download log" for sharing.
- **Stored log management (decision)**: monthly append-only files in `%APPDATA%\rto-invoice-prep\logs\rto-invoice-prep-YYYY-MM.log`, created on first write of the month. **The tool never rotates away or auto-deletes logs** — the log is the audit trail if RTO ever questions an invoice; deletion is the user's manual choice, month by month. Scale makes this trivial (~100–200 KB/year at one desk), so there is no rotation policy code to build; the month in the filename *is* the management.
- **"Open log folder"** button added next to "Download log" in the log modal (`shell.openPath` on the logs dir in the real app) so older months are reachable without digging through app-data.
- **Help menu separators regrouped**: User guide · Open Log — Check for updates · Report a bug — About (docs/diagnostics first, app-maintenance actions together, About last). 
- **File menu rearranged**: Upload Invoice first (the app's primary action), New Window, Quit last.
- **Native keyboard behavior** — covered by Electron itself: `Menu.setApplicationMenu` provides the accelerators shown in the menus (Ctrl+O, Ctrl+Shift+N, Ctrl+Q, Ctrl +/−/0, F12), Alt menubar traversal (Alt+F/V/H), and the &mnemonics for every item — no app code needed. The prototype only documents the mnemonics as underlined letters in the labels; it does not emulate the wiring. Esc closes menu/modal in the prototype.
- **Log modal head**: "Log — this session" alone (the filename left the header — it flows badly beside the title); the Open Folder button's tooltip carries the actual month file (`rto-invoice-prep-2026-09.log`); buttons labeled "Open Folder" and "Download" (icon-only read too ambiguous).
- **Help menu regrouped again** (final): User guide — Open Log · Report a bug — Check for updates · About. Shape follows Firefox/VS Code: documentation alone, diagnostics+support together, maintenance and About last.
- **Log modal slimmed**: header title is just "Log — this session"; the buttons are icon-only (folder = open log folder, download = save a copy) with the detail in tooltips — the full stored filename (`rto-invoice-prep-YYYY-MM.log`) lives in the folder button's tooltip; square icon-button styling, aria-labels kept.

## Answer

**Verdict: Variant D — "The Native Window".** The Inspector layout (variant C) dressed in Microsoft Fluent (Win11), chosen over C's custom look so the app reads as Windows-native. All decisions below were driven against the live prototype (14 reaction rounds, 2026-09-23); figures are the real sample's to the paisa.

### Design language
- **Fluent / Win11**: Segoe UI, mica-grey window (#F3F3F3), white cards with 1px #E5E5E5 borders, 8px card radius / 4px control radius, accent #005FB8. Dark theme follows **`prefers-color-scheme`** (no picker in v1): #202020 window, #2B2B2B cards, #4CC2FF accent for links/progress, dark annotation panels; real app sets `nativeTheme.themeSource = "system"`.
- **Window chrome**: default OS titlebar carrying "RTO Invoice Prep v0.1" (plain frame, or `titleBarOverlay` on Win10+); no custom titlebar. Cross-platform-safe: window controls stay native, all app controls live in plain DOM.
- **Platform floor: Windows 10** (Win7/8.1 explicitly not supported — it would pin Electron 22, an EOL Chromium; see round 4). Build on a current Electron line.
- **Native application menu** (`Menu.setApplicationMenu`, rendered under the titlebar): **File** → Upload Invoice (Ctrl+O), New Window (Ctrl+Shift+N), Quit (Ctrl+Q); **View** → Zoom in/out/reset (Ctrl +/−/0), Developer Tools (F12); **Help** → User guide, Open Log — Check for updates, Report a bug — About. Accelerators, Alt menubar traversal and &mnemonics are Electron-native (no app code); labels carry underlined access keys (U/N/Q · i/o/R/T · G/L/U/B/A). Esc closes menu/modal.

### Toolbar
- Left: File / View / Help menus. Right: **output directory** as a folder-picker button (native `openDirectory`; no free-text field; defaults to Downloads) + **export combo**: primary "Export N files" writes individual PDFs; ▾ dropdown offers "Export as Zip" (save dialog opens with the zip name — default `rto-invoices-YYYY-MM-DD.zip` — prefilled; no rename UI).

### Upload / ingest
- **Upload block button** in the rail ("Upload invoices / or drop PDFs anywhere in this window") + **whole-window drag & drop** (full-window dashed overlay while dragging).
- **Ingest progress**: "Reading N of M…" with a determinate bar; rows appear as each PDF finishes parsing.

### Left rail / preview card
- Rail: one row per file with pass/fail dot, ✕ on any row (valid or refused).
- Card: filename + **download icon** top-right. **No output-filename input** — naming happens in the save dialog (default `<original>-RTO.pdf` prefilled). *(Supersedes ticket 05's editable per-row name field.)* No "Recalculated" chip; no "Check before export" note (explainer moved to the user guide; amount-in-words became a facsimile row).
- **Details grid**: Invoice no., Customer, Invoice date, Model, Chassis no., Engine no.; unparsable fields render `~unreadable~`; nothing extractable → "Invoice details could not be extracted."
- **Totals facsimile**: Sub Total; Discount row struck with "✕ removed"; old struck → new amber-highlighted for Taxable/CGST/SGST/Ex-showroom/Round off/Grand total; Amount in words (old → new).
- **Refused cards**: details grid when metadata parses; failing rows marked ("✕ does not add up" / "✕ field not found"); red annotation with ticket-08's named-field reasons; never exportable.

### Modals (Fluent centred dialog, dimmed backdrop; ✕ / backdrop / Esc close)
- **Log — this session**: OK lines (taxable/total → wrote path) and REFUSED lines in red. Buttons: **Open Folder** (`shell.openPath` on the logs dir) and **Download** (save dialog copy).
- **Stored log management**: monthly append-only `%APPDATA%\rto-invoice-prep\logs\rto-invoice-prep-YYYY-MM.log`; **the tool never rotates away or auto-deletes** — the log is the audit trail; deletion is manual, month by month (~100–200 KB/year at one desk).
- **User guide**: what it does / how to use it / where files go; **View full documentation** header button → GitHub Pages docs.
- **About** (headerless, airy): app icon, name, version line with inline **Check for updates** (also in Help menu; `autoUpdater.checkForUpdates()` per ticket 06), tagline, purpose, runtime versions (`process.versions`); links row **Website · Source · Report a bug · Feature request** — all URLs live in one `APP_LINKS` constant (GitHub Pages site/docs, repo, issue-template URLs; dev to fill in the TODOs).

### Prototype capture
Full artifact (4 variants A–D, all behaviors) kept at `.scratch/rto-invoice-fixer/prototype/ui-prototype.html` on the current branch, **uncommitted** — the dev will commit it (to a reference branch) together with the rest of the work. Nothing has been committed yet. (Local preview server on :8399 was stood down after settling.)
