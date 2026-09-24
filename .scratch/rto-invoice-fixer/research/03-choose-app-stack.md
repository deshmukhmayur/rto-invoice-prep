# Research: Choose the app stack

Ticket: [.scratch/rto-invoice-fixer/issues/03-choose-app-stack.md](../issues/03-choose-app-stack.md)
Date: 2026-09-23
Scope: stack for a single-user Windows desktop app (batch PDF input → recalc → modified PDF out), built by one unpaid dev on Linux, shipped to a non-technical Windows user.

## Recommendation

**Electron, with pdf.js (extraction) + pdf-lib (modification/drawing). Build the Windows NSIS installer from Linux with electron-builder (+ Wine, or the official Docker image), no Windows machine needed.**

Runner-up: Python GUI packaged with PyInstaller + PyMuPDF — its PDF toolkit is the strongest of all three, but it forces a Windows CI runner for every build and drags AGPL obligations. Tauri is the weakest fit here: smallest binaries, but it puts the PDF work in Rust, needs the heaviest cross-compile setup, and its Linux→Windows path is officially a "last resort".

Note: ticket 04 (PDF technique: in-place surgery vs regeneration) decides *how* the numbers get rewritten; this note establishes what each stack *can* do, which feeds that decision.

## Decisive facts

1. **Electron is the only option that builds a Windows installer entirely on the Linux dev box, officially.** electron-builder documents "Build for Windows on Linux": install Wine (or use the `electronuserland/builder:wine` Docker image); NSIS does not require Mono. [electron-builder Multi Platform Build]. Tauri's `.msi` (WiX) *only* builds on Windows; its NSIS cross-compile from Linux via `cargo-xwin` + LLD + NSIS exists but the docs say it "is not as straight forward … is not tested as much. Therefore it should only be used as a last resort" — the recommended path is a Windows CI runner. PyInstaller never cross-compiles; it "builds apps that are compatible with the macOS release in which you run it" and likewise needs Windows 8+ on the build machine for Windows targets. [Tauri Windows Installer docs; PyInstaller requirements]
2. **The Node PDF pair is permissively licensed and pure JS — no native modules, no AGPL.** pdf.js (Apache-2.0) extracts text with positions: `getTextContent()` returns items carrying a `transform` matrix, `width`, `height`, and `fontName` per run [pdf.js api.js]. pdf-lib (MIT) modifies existing PDFs, embeds TTF fonts, draws text/rects at exact coordinates, and measures text width [pdf-lib README]. Its documented Limitations matter, though: pdf-lib **cannot extract page text and cannot remove/edit page text outside form fields** [pdf-lib Limitations] — so the "remove the discount row" step must be *cover with a white rectangle + redraw recalculated values at the same coordinates*, which is exactly what the accepted manual edit does (see map.md baseline), not a true content-stream edit.
3. **The single best PDF library overall is Python's PyMuPDF (AGPL-3.0 / commercial).** Its feature matrix shows: positioned text extraction, write text to page (`insert_textbox`/`insert_htmlbox`/TextWriter), PDF redactions, vector drawing, rendering pages to images (for previews), font subsetting, automatic repair of damaged PDFs — and it benchmarks fastest at text extraction and rendering against pypdf/pdfminer/pikepdf [PyMuPDF about page]. If ticket 04 concludes regeneration or genuine redaction is needed rather than cover-and-redraw, PyMuPDF is the tool that makes that trivial — but it makes Python + PyInstaller the stack, forcing a Windows CI runner (GitHub Actions `windows-latest`) for builds, and any distribution of the app to the dealership employee triggers AGPL source-sharing obligations (manageable for an in-house single-user tool, but an obligation).
4. **MuPDF.js on Node (`mupdf`, the official Artifex package) is AGPL-3.0-or-later**, the same licensing situation as PyMuPDF, and is actively released (1.28.1, Sep 2026) [npm mupdf]. Using it in Electron would buy MuPDF-grade editing inside Electron but reintroduces the AGPL question the pure-JS pair avoids.
5. **Tauri's PDF story is workable but puts everything in a second language.** The best Rust option is `pdfium-render` (MIT/Apache dual-licensed wrapper, very active: 0.9.4 Sep 2026) over Google's pdfium (permissive BSD-style, prebuilt DLLs from bblanchon/pdfium-binaries, ~6 MB). It covers positioned text extraction, page-object creation (text/paths/bitmaps), object transformation, custom font loading, and rendering [pdfium-render README]. That's extraction + redraw capability comparable to the Node pair — but the GUI then needs JS *and* Rust (or a Node sidecar), plus the cross-compile toolchain from fact 1, for a benefit (binary size) that a single desktop user doesn't pay for.

## 1. Cross-compilation: Linux dev → Windows .exe/installer

| Option | Build Windows artifact from Linux? | Toolchain |
| --- | --- | --- |
| Electron + electron-builder | **Yes, officially supported.** Wine 2.0+ required (or Docker image `electronuserland/builder:wine`); NSIS target needs no Mono. No native node_modules in this stack, so the Wine caveat about native deps doesn't bite. | Node + Wine; or GitHub Actions `windows-latest` |
| Tauri | `.msi`: **no** (WiX runs only on Windows). NSIS `-setup.exe`: yes with caveats — `rustup target add x86_64-pc-windows-msvc`, `cargo install cargo-xwin`, LLVM/lld + `llvm-rc`, NSIS with stubs/plugins. Docs explicitly call it a last resort vs. local VMs or CI. | Rust MSVC target + cargo-xwin + LLD + NSIS; or GitHub Actions `windows-latest` |
| Python + PyInstaller | **No.** PyInstaller builds for the platform it runs on; Windows builds need a Windows machine or Windows CI runner. | GitHub Actions `windows-latest` (or any Windows box) |

CI cost context (only relevant if the repo is private): GitHub Actions is free on public repos; private repos get 2,000 free minutes/month on the Free plan, with Windows runners billing at $0.010/min vs Linux $0.006/min [GitHub Actions billing].

## 2. PDF capability per ecosystem

### Node / Electron (recommended pairing)

- **Extract (pdf.js, Apache-2.0):** `page.getTextContent()` returns items with `str`, `transform` (the rendering matrix → position and scale), `width`, `height`, `fontName`. Sufficient to locate the discount line and every total's coordinates.
- **Modify (pdf-lib, MIT):** loads existing PDFs, embeds arbitrary TTF fonts (`@pdf-lib/fontkit`), draws rectangles (white-out) and text at coordinates, measures text width for right-aligned redraws. Explicitly *cannot* delete or edit existing non-form-field text — cover-and-redraw only.
- **Alternative (mupdf, AGPL-3.0-or-later):** official Artifex MuPDF.js WASM package; full extraction, redaction, and insertion in one lib, usable in Electron's main process. Chosen only if cover-and-redraw proves insufficient and AGPL is acceptable.

### Rust / Tauri

- **pdfium-render** over pdfium: positioned text extraction (segments/chars/objects with bounds), creation of new text objects with custom fonts, object transforms, watermarking, rendering pages to bitmaps (for the preview pane). No text-position-based *editing* API at MuPDF's level; object add/replace/remove is the idiom.
- **lopdf** (pure Rust) could do raw content-stream surgery but is low-level and does not help with extraction.
- The GUI must call Rust via IPC, or bundle a Node sidecar (Tauri documents this pattern), adding two runtimes to one dev's project.

### Python / PyInstaller

- **PyMuPDF (AGPL/commercial)** is the strongest single library across all ecosystems: positioned extraction (words/rects/dict), `insert_textbox`/`insert_htmlbox` with font handling, redaction annotations, drawing, page rendering for previews, damaged-PDF repair, best-in-class extraction/rendering benchmarks. PySide6 or tkinter for the GUI; PyInstaller for packaging (Windows CI required).

## 3. Practical trade-offs

| | Electron | Tauri | Python + PyInstaller |
| --- | --- | --- | --- |
| Output size | Electron runtime itself is 158.1 MB zipped (v44.4.4 `electron-v44.4.4-win32-x64.zip`, from the Electron GitHub release); NSIS installers of trivial apps land ~90–110 MB | Single-digit MB app; uses system WebView2, which "is distributed as part of the operating system" on Windows 10 (April 2018+)/11 [Tauri docs] | ~30–80 MB onefile exe (CPython + PyMuPDF); onefile re-extracts at each launch |
| Memory | Highest (Chromium, multi-process) — irrelevant for one desktop user | Low | Low |
| Packaging simplicity | electron-builder NSIS from Linux, documented path; auto-update via electron-updater | Needs Windows CI for MSI, or the last-resort NSIS cross-compile; updater needs signing keys | PyInstaller straightforward but Windows-only builds; auto-update DIY |
| Languages | One (JS/TS) | Two (JS UI + Rust backend) | One (Python), but GUI toolkit quality varies (tkinter crude; PySide6 fine) |
| PDF work | pdf.js + pdf-lib (permissive, pure JS) | pdfium-render (permissive, Rust) | PyMuPDF (best toolkit, AGPL) |
| License entanglement | None | None | AGPL if using PyMuPDF (commercial license is paid) |
| Maintenance for one unpaid dev | Low: single language, no native builds, mature builder | Highest: two toolchains, cross-compile caveats, version-pinned pdfium binaries | Low, but CI-only builds and AGPL bookkeeping |

Size and memory are non-goals here: the user runs one app on one dealership desktop. What matters is the dev's build path and the PDF library fit — both favor Electron, with Python+PyMuPDF as the fallback if ticket 04 shows cover-and-redraw is not enough.

## Sources

- Tauri v2 — Windows Installer (MSI-only on Windows; NSIS cross-compile via cargo-xwin marked "last resort"; WebView2 ships with Windows 10+/11): https://tauri.app/distribute/windows-installer/
- electron-builder — Multi Platform Build (Windows targets on Linux with Wine/Docker; NSIS needs no Mono): https://www.electron.build/docs/features/multi-platform-build
- PyInstaller — Requirements (builds for the platform it runs on; Windows 8+): https://pyinstaller.org/en/stable/requirements.html
- GitHub Actions billing (free on public repos; private plan minutes; Windows $0.010/min): https://docs.github.com/en/billing/concepts/product-billing/github-actions
- pdf-lib README + Limitations (modify/draw/embed fonts; cannot extract or edit page text outside form fields; MIT): https://github.com/Hopding/pdf-lib
- pdf.js `getTextContent` TextItem with `transform` matrix (Apache-2.0): https://github.com/mozilla/pdf.js/blob/master/src/display/api.js
- MuPDF.js npm package (AGPL-3.0-or-later, Artifex, v1.28.1 Sep 2026): https://www.npmjs.com/package/mupdf
- PyMuPDF about page (feature matrix: write text, redactions, extraction, rendering; AGPL + commercial; benchmark results): https://pymupdf.readthedocs.io/en/latest/about.html
- pdfium-render README (capabilities: text extraction, page-object creation/transformation, custom fonts, rendering; pdfium binaries at bblanchon/pdfium-binaries; 0.9.4 Sep 2026 per crates.io): https://github.com/ajrcarey/pdfium-render
- Electron release v44.4.4 asset sizes (win32-x64 zip = 158.1 MB): https://github.com/electron/electron/releases
- pypdf README (pure-Python extract/modify, no rendering; contextual alternative): https://github.com/py-pdf/pypdf
