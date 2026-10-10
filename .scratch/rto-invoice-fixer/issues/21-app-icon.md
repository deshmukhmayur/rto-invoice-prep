# 21: App icon

**What to build:** a real application icon so the packaged app doesn't show the default Electron icon. Discovered during ticket 19's portable test build (electron-builder warning: "default Electron icon is used"). Needs a Windows `.ico` (multi-size, ≥256px) referenced in `build.win.icon`; electron-builder will convert from a single high-res source (PNG ≥512px) if given `icon.png`/`icon.ico` in the build resources dir. The icon should read the "RTO Invoice Prep" identity — consider a document/receipt glyph with the brand accent (#005FB8 light / #4CC2FF dark family) — and work at 16px taskbar size. Optionally also a Linux/`icon.png` for dev `bun start` windows, though Windows is the only shipped platform.

**Blocked by:** 19 (done).

**Status:** implemented (pending Windows verification)

- [x] Icon source (SVG or ≥512px PNG) committed to the repo
- [x] `build.win.icon` set in package.json; packaged exe shows the icon in Explorer, taskbar, and Alt-Tab
- [x] Window-level icon acceptable to skip (Windows uses the exe icon for packaged builds)
- [ ] Verify on a Windows machine via the portable build
