# 03 - Choose the app stack

Type: research (AFK)
Status: resolved

Research note: [research/03-choose-app-stack.md](research/03-choose-app-stack.md)

## Question

Tauri vs Electron (or another wrapper) for a standalone Windows desktop app that must:

- Present a simple GUI (file pick / drag-drop, preview, export)
- Read text and modify existing PDFs (or render new ones)
- Ship as a double-clickable .exe/installer for a non-technical Windows user

Deciding facts: cross-compilation story from the dev's Linux machine (can a Windows exe be produced without a Windows box, or via GitHub Actions?), quality of PDF libraries in each ecosystem (pdf-lib, MuPDF bindings, etc. — can they edit in place / rewrite text?), binary size, and maintenance burden for a one-dev unpaid project.

Record findings in a research note under `.scratch/rto-invoice-fixer/research/` and link it from this ticket.

## Answer

**Electron**, with pdf.js for extraction and pdf-lib for modification, packaged as a Windows NSIS installer via electron-builder on Linux (Wine/Docker). Fallback if ticket 04 shows cover-and-redraw is insufficient: Python + PyMuPDF + PyInstaller (needs a Windows CI runner; AGPL).

Decisive facts:
1. Electron is the only option that officially builds a Windows installer from Linux; Tauri's Linux→Windows cross-compile is a documented "last resort", PyInstaller never cross-compiles.
2. pdf.js (Apache-2.0) extracts text with per-run position matrices; pdf-lib (MIT) draws rects/text at exact coordinates — pure JS, no native modules, no license entanglement.
3. pdf-lib cannot delete or edit existing page text (documented limitation) — the discount row is removed by white-rectangle cover + coordinate-precise redraw, matching the accepted manual-edit baseline.
4. PyMuPDF / MuPDF.js, the strongest PDF libraries, carry AGPL — avoided in the primary pick.
5. Electron's size/RAM costs don't matter for one desktop user.

Full note: [research/03-choose-app-stack.md](research/03-choose-app-stack.md)
