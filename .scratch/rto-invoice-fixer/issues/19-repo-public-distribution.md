# 19: Repo public-ready & distribution

**What to build:** ship it. Per the spec's §8 amendment (dev decision, 2026-09-24): before the repo goes public, **add `.scratch/samples/` to `.gitignore`** and ensure the real invoice samples (customer PII) are never committed. electron-builder NSIS config: one-click, per-user (`oneClick: true`, `perMachine: false`), stable appId, product name `RTOInvoicePrep`; GitHub Actions workflow on `windows-latest` triggered by tag push, running on Bun (`oven-sh/setup-bun` — install/build/publish all via `bun`, never npm), publishing a **draft** GitHub Release (`--publish always`). electron-updater with the GitHub Releases provider and `owner`/`repo` **set explicitly** in the publish config (the update feed is this public repo — baked into `app-update.yml` at build time; never call `setFeedURL`); updates install silently on quit. Draft releases are invisible to the updater until promoted; portable .exe is not a primary artifact.

**Blocked by:** 16, 17, 18.

**Status:** done

- [ ] `.scratch/samples/` is gitignored and verified absent from the tracked tree before anything is published
- [ ] Tag push builds the unsigned NSIS installer in CI and attaches it to a draft GitHub Release on this repo
- [ ] Installer installs per-user on Windows 10 without UAC; electron-updater finds a promoted release via the explicitly configured owner/repo and applies it silently on quit
- [ ] User guide warns about the SmartScreen "Run anyway" step and the Windows 11 Smart App Control blocker
