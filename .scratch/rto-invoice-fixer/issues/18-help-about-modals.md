# 18: Help & About modals

**What to build:** the Help-menu destinations as centred Fluent modals (dimmed backdrop; ✕ / backdrop / Esc close): **User guide** (what it does / how to use it / where files go; "View full documentation" → GitHub Pages docs) and **About** (app icon, name, version line with inline "Check for updates" per ticket 19's wiring, tagline, purpose paragraph, runtime versions via `process.versions`, links row Website · Source · Report a bug · Feature request). All external URLs live in one `APP_LINKS` constant at the top of the renderer, opened via `shell.openExternal`; unresolved URLs stay as TODO constants.

**Blocked by:** 13.

**Status:** ready-for-agent

- [ ] Help menu items open the matching modals; Esc/backdrop/✕ close them
- [ ] About shows the version line, runtime versions (`process.versions`), and the four-link row from one `APP_LINKS` constant
- [ ] User guide covers the tool's purpose, usage, and file locations per the prototype
