# 06 - Distribution approach

Type: research (AFK)
Blocked by: 03
Status: resolved

Research note: [research/06-distribution-approach.md](research/06-distribution-approach.md)

## Question

How does the app get onto the acquaintance's Windows machine and stay updated? Options per chosen stack: single portable .exe, NSIS/MSI installer, GitHub Releases + a simple update check. Cover: cross-compile/build pipeline (likely GitHub Actions from this repo), code-signing reality check (unsigned exe warnings and whether that's acceptable), and the simplest update path for a non-technical user.

Record findings in a research note under `.scratch/rto-invoice-fixer/research/` and link it from this ticket.

## Answer

**Default one-click NSIS installer, built in CI on `windows-latest` (GitHub Actions, tag push, `--publish always` → draft release), no code signing (unobtainable: Azure Trusted Signing is US/Canada individuals only; OV is $150–300/yr + hardware token), and electron-updater with the GitHub Releases provider pointed at a publicly-readable repo (make the repo public, or use a separate public releases-only repo).**

Decisive facts:
1. NSIS defaults are already right: `oneClick: true` + `perMachine: false` = one-click, per-user install, no UAC on install or updates. The appId must never change (it derives the install GUID).
2. NSIS is the only auto-updatable Windows target; electron-updater + GitHub provider is ~5 lines and installs updates on quit silently — but needs publicly readable releases (draft releases are invisible until promoted).
3. Azure Artifact Signing (~$9.99/mo, Microsoft's cheapest signing) accepts individual devs only in the USA/Canada; OV certs are $150–300/yr with a mandatory HSM; EV lost its SmartScreen bypass in 2024; self-signed is worse than unsigned. So: sign nothing.
4. Unsigned installer UX on Win10/11: SmartScreen "Windows protected your PC" → "More info" → "Run anyway" — one-time friction, not a blocker. Real blocker: Windows 11 Smart App Control (if on) blocks unsigned with no override.
5. Portable .exe exists (`--win portable`) but is a dead end as the primary artifact: no auto-update, temp-dir extraction each launch.

Full note: [research/06-distribution-approach.md](research/06-distribution-approach.md)
