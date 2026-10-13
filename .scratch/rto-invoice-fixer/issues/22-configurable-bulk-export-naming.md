# 22: Configurable file naming for bulk exports

**What to build:** let users control the names of files produced by bulk export. Today both bulk paths write a hardcoded pattern — `<original>-RTO.pdf`, deduped with ` (n)` — in `export:save-batch` (src/main.ts:197) and `export:save-zip` entries (src/main.ts:223); only single-file export is renameable via its save dialog (src/main.ts:97). Add a naming option surfaced in the export UI (e.g. an editable suffix/prefix or a pattern template such as `{name}-RTO-{date}`), which both bulk paths honour, keeping `uniqueName()` dedup and validation (no `/ \ :` etc.) on the resolved names.

**Blocked by:** —

**Status:** needs-triage

Open questions for triage:

- Pattern template (full control, `{name}` placeholder) vs simple suffix/prefix input?
- Where does the setting live — inline on the export panel (persisted) or per-export only?
- Does the single-file save-dialog default follow the same setting, so naming stays consistent?
- ZIP inner entry names: same pattern, and does the ZIP's own name (`zipNameForToday()`, renderer.ts:174) become configurable too?
