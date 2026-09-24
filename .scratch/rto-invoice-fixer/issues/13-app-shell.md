# 13: App shell

**What to build:** the Electron scaffold of RTO Invoice Prep — launching the app opens the Variant-D window (Fluent/Win11 design language per spec §6): default OS titlebar reading "RTO Invoice Prep v0.1", the native File/View/Help application menu with Electron-native accelerators and mnemonics, system light/dark theme (`nativeTheme.themeSource = "system"`, no picker), and the first-launch empty state (centred dashed panel, "No invoices yet", three entry routes, "nothing is stored between sessions" line). DevTools stays reachable via F12 per spec.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] App launches to the empty state styled per the prototype's Variant D
- [ ] File (Upload Invoice Ctrl+O, New Window Ctrl+Shift+N, Quit Ctrl+Q), View (Zoom in/out/reset, DevTools F12), Help menus all present with working accelerators; mnemonics/Alt traversal come from Electron's native menu
- [ ] Window follows the OS light/dark theme; title reads "RTO Invoice Prep v0.1"
- [ ] Project is TypeScript (main + renderer), with Bun (`bun install`) as the package manager/script runner — no npm anywhere
- [ ] Demoable: run the app, exercise every menu item that exists so far
