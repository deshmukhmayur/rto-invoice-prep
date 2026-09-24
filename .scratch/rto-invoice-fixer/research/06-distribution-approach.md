# Research: Distribution approach

Ticket: [.scratch/rto-invoice-fixer/issues/06-distribution-approach.md](../issues/06-distribution-approach.md)
Date: 2026-09-23
Scope: how the Electron app gets onto one non-technical Windows user's machine and stays updated: NSIS installer config (one-click vs assisted vs portable), CI build on git tag, code-signing reality for an unpaid hobby project (SmartScreen on Win10/11), and the simplest reliable update path. Follows [research/03-choose-app-stack.md](03-choose-app-stack.md) (Electron + electron-builder decided).

## Recommendation

**Ship the default one-click NSIS installer, built by a GitHub Actions workflow on a `windows-latest` runner (Ubuntu+Wine Docker image as the local-box fallback), published to GitHub Releases on `v*` tag push. Skip code signing entirely — tell the user once, explicitly, how to click through the SmartScreen warning. For updates, use electron-updater with the GitHub Releases provider, pointing at a repo where the releases are publicly readable — either the code repo made public, or a separate public "releases-only" repo set explicitly in the publish config.**

Why not the alternatives:

- **Assisted installer (`oneClick: false`)** — adds a wizard with install-directory/mode choices a non-technical user shouldn't be asked. The default one-click installs per-user with no UAC prompt and just works.
- **Portable `.exe`** — it exists as a target (`--win portable`) but is a dead end as the primary distribution: it re-extracts to a temp dir on every launch, and NSIS is the only auto-updatable Windows target, so portable means every update is "go to a link and download a new exe" forever. Build it at most as a throwaway debug artifact.
- **Code signing now** — not obtainable for this project: Microsoft's own signing service (Azure Artifact Signing, ~$9.99/mo, the cheapest realistic option) accepts **individual developers only in the USA and Canada**; the dev is in India. Traditional OV certs are $150–300/year and, since June 2023, require an HSM/hardware token. SignPath Foundation is free but requires a qualifying open-source project. Self-signed is *worse* than unsigned. An unsigned installer is a one-click-through warning, not a blocker.
- **Update path without electron-updater** ("just send a new installer link") — workable but strictly worse for a single user: it relies on the user finding the right file among release assets, and nothing stops them re-running an old installer. electron-updater is ~5 lines of code, checks on app start, downloads in the background, and installs on quit with no UAC (per-user NSIS). Its only hard requirement is that the update feed (GitHub Releases) is publicly readable — which pushes the one real decision: repo visibility.

## Decisive facts

1. **The default NSIS config needs almost nothing.** `oneClick` defaults to `true`, `perMachine` to `false` — the out-of-the-box build is a one-click, per-user installer with no install-directory page and (being per-user) no elevation prompt. The artifact template is `${productName} Setup ${version}.exe`. The one thing to treat as frozen: the uninstall/update identity is a UUIDv5 GUID derived from `appId` (or `name`), so **the appId must never change once installed** — product name and description can change freely. [nsisOptions.ts source; NSIS docs "GUID vs Application Name"]
2. **The only auto-updatable Windows target is NSIS.** electron-updater's supported targets are DMG (mac), AppImage/DEB/RPM (Linux), and **NSIS (Windows)** — Squirrel.Windows and portable are explicitly not supported. electron-builder writes the update feed (`app-update.yml` + `latest.yml` into the release) automatically; the app side is `autoUpdater.checkForUpdatesAndNotify()`. [Auto Update doc]
3. **Azure Artifact Signing (formerly Trusted Signing) is closed to Indian individuals.** Microsoft's own table: ~$9.99/month, "Individuals: USA and Canada only"; individuals elsewhere are directed to OV certificates. OV: "$150–300/year", private key on HSM/token mandatory since June 2023 (CA/Browser Forum). EV ($400+/year) lost its instant-SmartScreen-bypass in 2024 — it now behaves like OV. Self-signed triggers "the same [behavior] as no signature" but breaks electron-updater's update-signature verification. [Microsoft, Code signing options; SmartScreen reputation]
4. **What the unsigned user sees, verbatim, from Microsoft's docs:** a SmartScreen prompt — "Warning — 'Windows protected your PC'; User must choose 'Run anyway' before the app can run" (behind the "More info" disclosure). And one genuine blocker to warn about: on Windows 11, **Smart App Control** "may supersede SmartScreen Application Reputation" and "will block execution of unsigned files unless the file has a positive reputation" — if SAC is on, there is no "Run anyway". SAC is typically in evaluation/off state on existing installs, but the user must be told not to switch it on for this machine. [Microsoft, SmartScreen reputation]
5. **electron-updater needs publicly readable releases.** The GitHub provider defaults to being auto-detected and, for a **private** repo, requires `GH_TOKEN` set on the *user's machine* — which the docs themselves call "only for very special cases — not intended and not suitable for all users". With a public repo (or public releases repo set via `publish: { provider: "github", owner, repo }`), the user needs nothing at all. Also: draft releases are invisible to electron-updater, so the CI-created draft must be manually published (a 10-second GitHub click that doubles as a review gate). [publish.md + Auto Update doc]

## 1. The NSIS setup, concretely

Minimal `electron-builder.yml` for this case:

```yaml
appId: com.deshmukh.invoicefixer   # NEVER change this once the user has installed
productName: Invoice Fixer
directories:
  buildResources: build            # build/icon.ico picked up automatically
files:
  - build/**/*
  - dist-electron/**/*
win:
  verifyUpdateCodeSignature: false # honest for unsigned builds; avoids updater failing on signature check
nsis:
  artifactName: "${productName} Setup ${version}.${ext}"
  deleteAppDataOnUninstall: false
publish:
  provider: github
  owner: <owner>                   # set explicitly, per the docs' "keep control of it" warning:
  repo: <repo>                     # auto-detection from .git/config becomes the *lifetime* update feed baked into the installer
```

Defaults that matter (all correct without being set): `oneClick: true` (one-click, no wizard); `perMachine: false` (per-user, no UAC on install or on updates — ideal for a non-admin dealership account); `unicode: true`; differential updates on (`differentialPackage: true`, so updates download deltas via the blockmap). If a wizard is ever wanted, it's `nsis.oneClick: false` (assisted mode; then `allowToChangeInstallationDirectory`, `perMachine`, `selectPerMachineByDefault` come into play).

**Portable option:** `--win portable` produces a single no-install .exe (runs with `requestedExecutionLevel: user`, unpacks to a temp dir per launch, exposes `PORTABLE_EXECUTABLE_DIR` etc.). Fine as a quick test vehicle; not the distribution format — no auto-update support, and every launch pays an extraction cost.

**Linux+Wine build — what to get right:**

- Wine 2.0+ is required (it runs the NSIS resource/icon editing); **Mono is not required for NSIS** (only for Squirrel.Windows). Simplest: Docker `electronuserland/builder:wine` — but v27 needs Node ≥22.12, so pin a Node 22/24-flavored, date-tagged variant (the docs advise locking `FROM` to a date tag like `builder:24-07.23` to avoid surprise toolset upgrades; the old Node 20 tags don't satisfy v27). [Multi Platform Build]
- Native node_modules can't be cross-compiled inside Docker — irrelevant for this stack (pdf.js/pdf-lib are pure JS).
- Failure points seen in practice, from the official troubleshooting page: `"wine: command not found"` → use the wine Docker image or install Wine on the host; toolset downloads (NSIS `nsis-3.0.4.1`, winCodeSign) happen on first build and are cached in `ELECTRON_BUILDER_CACHE` (~/.cache/electron-builder) — on ephemeral CI, persist or accept the re-download; "installer is corrupt" artifacts → antivirus modifying the file during download.
- Unsigned builds are the default when no signing env is set; `forceCodeSigning: true` would turn that into an error — **do not set it**, or the CI build fails.

## 2. GitHub Actions workflow sketch (tag → installer → release)

The officially documented pattern (electron-builder's own GitHub Actions guide uses `windows-latest` for the Windows leg — no Wine needed in CI, which is one less moving part than the Linux path; the Wine/Docker path is for the dev's own box):

```yaml
name: Release
on:
  push:
    tags: ['v*']

permissions:
  contents: write          # REQUIRED: without this the release step fails
                           # "Resource not accessible by integration"

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx electron-builder --win --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}   # token electron-builder uses to upload release assets
```

Details that trip people up:

- **v27 removed implicit publishing**: nothing uploads unless `--publish always/onTag/onTagOrDraft` is passed (or a `release` npm script exists). With `--publish always` on a tag push, electron-builder creates a **draft** release (if none exists) and attaches `Setup.exe`, `latest.yml`, and the blockmap.
- **Draft releases are invisible to electron-updater** — after CI goes green, open the draft and click "Publish". (Alternative: `releaseType: draft` in config + manual promote is the documented review-gate pattern; or drop a `gh release edit vX.Y.Z --draft=false` step into the workflow.)
- Tag must match `version` in package.json (the GitHub provider's `tagNamePrefix` defaults to `"v"`; electron-updater resolves the release by the version embedded in `latest.yml`).
- Cost: GitHub Actions is free on public repos; on private repos the Free plan includes 2,000 minutes/month with Windows at $0.010/min — one Windows build (~5–10 min) ≈ $0.05–0.10, so effectively free for this cadence. [GitHub Actions billing; carried from note 03]
- If the code repo must stay private forever, the *whole workflow still works the same* — see §4 for what that does to the updater.

## 3. Code-signing reality check

**What the user actually experiences (Windows 10 and 11, unsigned download):**

1. Browser downloads `Invoice Fixer Setup 1.0.0.exe`. Edge/Chrome may show a generic "isn't commonly downloaded" caution; keep it.
2. On double-click, SmartScreen intercepts: **"Windows protected your PC"** — "Microsoft Defender SmartScreen prevented an unrecognized app from starting". The only visible button is **"Don't run"**.
3. The user must click **"More info"**, which reveals the publisher line ("Unknown publisher") and a **"Run anyway"** button. One more confirm and the installer runs.
4. The app then installs per-user, silently, no UAC (one-click + `perMachine: false`).

This is Microsoft's documented design: unsigned files "must choose 'Run anyway' before the app can run", and enterprise policy can remove even that — irrelevant here, this is a dealership desktop, not an Intune fleet.

**The one real blocker: Windows 11 Smart App Control.** If SAC is on (it's opted-into on fresh Win11 installs after an "evaluation" period), unsigned executables are blocked outright with **no override** — there is no "Run anyway". SAC, once turned off, cannot be re-enabled; most existing machines are in evaluation/off. Guidance to the user: "if Windows says the app can't run and gives no 'Run anyway', that's Smart App Control — it should be off for this app to work". [Microsoft, SmartScreen reputation]

**Can signing be obtained? Options on the table, priced:**

| Option | Cost | Available to an individual dev in India? | Verdict |
| --- | --- | --- | --- |
| Azure Artifact Signing (formerly Trusted Signing) | ~$9.99/month, no hardware token, CI-native | **No** — individuals only in USA/Canada | Closed. Microsoft redirects individuals elsewhere. |
| OV certificate (DigiCert/Sectigo/…) | $150–300/year + HSM/token since June 2023 | Yes | 10–30× the app's (zero) budget, for a warning that mostly persists anyway. |
| EV certificate | $400+/year, hardware-bound | Yes | No SmartScreen benefit since 2024 — pays a premium for nothing. |
| SignPath Foundation | Free | Only for qualifying **open-source** projects | Becomes available only if the repo is opened anyway — worth revisiting if that happens, but OV-level signing still shows warnings until reputation builds. |
| Self-signed | Free | Yes | **Worse than nothing**: identical SmartScreen behavior, but electron-updater's signature verification and Windows trust both see a bogus cert. Don't. |
| Unsigned | Free | Yes | Recommended. |

[Microsoft, Code signing options; SmartScreen reputation; electron-builder Code Signing doc]

**Honest guidance to give the non-technical user (write this down, once, in plain language):**

> "When you first open the installer, Windows will show a blue message 'Windows protected your PC'. That's expected — I haven't paid for a software certificate, so Windows doesn't know me. Click **More info**, then **Run anyway**. You'll only see this the first time (and possibly after updates). If Windows blocks it with no 'More info' button, tell me."

Also practical: since the update feed is the same GitHub repo, anchor the user to **one place** (the Releases page or a short link) so they never need to hunt for files. Note 03's CI-cost logic applies here too: the user's trust problem is solved by the dev handing them the file personally the first time (WhatsApp/USB), not by a certificate.

## 4. Update path: electron-updater + GitHub Releases — yes, with one repo-visibility decision

**Recommendation: electron-updater with the GitHub provider, ~5 lines in the main process:**

```js
import { autoUpdater } from "electron-updater"
autoUpdater.checkForUpdatesAndNotify()   // on app start; installs on quit by default
```

Setup facts:

- electron-builder bakes the feed into `resources/app-update.yml` at build time from the `publish` config — **do not call `setFeedURL`**. Set `owner`/`repo` explicitly in the publish config so a repo rename/transfer can't strand the installed app (GitHub frees renamed names, so anyone could claim them and publish a malicious update).
- On Windows with a per-user NSIS install, the downloaded update installs **on quit with no UAC** (the docs' table: NSIS per-user → automatic install on next launch ✓ / on quit ✓; per-machine would prompt UAC).
- v27 hardening worth keeping in mind: `autoInstallEvent` defaults to `"onQuit"`; there's a session-end guard so a Windows shutdown can't corrupt a half-install; `"onNextLaunch"` becomes the default in v28.
- With unsigned builds set `win.verifyUpdateCodeSignature: false` (see §1) — otherwise the updater embeds/verifies a publisher name that doesn't exist.
- Debug with `autoUpdater.logger = electron-log` if an update ever fails silently at the dealership.

**Why not "download new installer from a link"?** It works, but: the user must pick the right asset from a release page (there will be `.exe`, `.blockmap`, `.yml` files side by side — confusing for a non-technical user), nothing stops them re-installing an older version, and every update costs the dev a manual "ping the user" step. electron-updater removes all of that for the price of one dependency and 5 lines.

**The repo-visibility decision this forces** (the ticket's "private-ish repo" caveat): electron-updater on a private repo needs `GH_TOKEN` on the *user's* machine — the docs' own warning is that private-repo updates are "only for very special cases — not intended and not suitable for all users". Not viable for a dealership employee. Options, in order of preference:

1. **Make the code repo public.** Releases are readable, updater needs zero configuration beyond `provider: github`. If the repo being public ever enables free code signing (SignPath Foundation), that's a bonus.
2. **Keep code private, add a public releases-only repo.** Set `publish: { provider: "github", owner, repo }` to the public repo; CI checks out the private repo and publishes artifacts there. The updater reads that public feed. Slightly more config, zero exposure of code.
3. **If neither is acceptable:** drop electron-updater; the manual path is "I'll send you the new Setup exe" (or a fixed link to a public release asset). Acceptable for one user, but re-introduces the stale-installer risk.

## Sources

- electron-builder — NSIS target docs (one-click vs assisted, portable, GUID/appId rule, custom scripts): https://www.electron.build/nsis (source: https://github.com/electron-userland/electron-builder/blob/master/website/docs/nsis.md)
- electron-builder — NsisOptions source (defaults: `oneClick: true`, `perMachine: false`, portable `requestExecutionLevel: user`): https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/targets/win/nsis/nsisOptions.ts
- electron-builder — Multi Platform Build (Wine 2.0+/`electronuserland/builder:wine` for Windows targets on Linux; Mono not needed for NSIS; native-deps caveat): https://www.electron.build/multi-platform-build (source: website/docs/features/multi-platform-build.md)
- electron-builder — GitHub Actions CI/CD (windows-latest workflow, `--publish always`, `GH_TOKEN`, `permissions: contents: write`, draft-release pattern, "Resource not accessible by integration" fix): https://www.electron.build/github-actions (source: website/docs/github-actions.md)
- electron-builder — Publish (GitHub provider; v27 removed implicit publishing; explicit owner/repo warning — detected repo becomes the lifetime update feed; draft releases): https://www.electron.build/publish (source: website/docs/publish.md)
- electron-builder — Auto Update (NSIS only auto-updatable target on Windows; `checkForUpdatesAndNotify`; app-update.yml baked at build; per-user NSIS auto-installs without UAC; v27 session-end guard / `autoInstallEvent`; private-repo GH_TOKEN "very special cases" warning; draft releases invisible): https://www.electron.build/auto-update (source: website/docs/features/auto-update.md)
- electron-builder — Code Signing (why sign; SmartScreen table unsigned = "Unknown publisher" warning; `forceCodeSigning`): https://www.electron.build/code-signing (source: website/docs/features/code-signing/code-signing.md)
- electron-builder — Windows Code Signing (OV vs EV since 2024; `win.sign` union; osslsigncode on Linux for file-based certs): https://www.electron.build/code-signing-windows (source: website/docs/features/code-signing/code-signing-win.md)
- electron-builder — Troubleshooting (`wine: command not found`; ELECTRON_BUILDER_CACHE; corrupt-installer/AV; draft-release "Cannot find latest.yml"): https://www.electron.build/troubleshooting (source: website/docs/troubleshooting.md)
- Microsoft — Code signing options for Windows app developers (Azure Artifact Signing ~$9.99/mo, individuals USA/Canada only; OV $150–300/yr + HSM since June 2023; EV no longer recommended for SmartScreen; self-signed "blocks installation for public users"; SignPath Foundation for OSS; unsigned = "Strong SmartScreen block"): https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Microsoft — SmartScreen reputation for Windows app developers (unsigned: "'Windows protected your PC'; user must choose 'Run anyway'"; reputation builds per-hash for unsigned; Smart App Control on Win11 blocks unsigned with no bypass): https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Microsoft — Distribution feature status (EV instant bypass removed in 2024, per Trusted Root Program change): https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/distribution-feature-status
- GitHub Actions billing (free on public repos; private Free plan 2,000 min/mo, Windows $0.010/min): https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Prior context: research/03-choose-app-stack.md (stack decision, CI cost baseline)
