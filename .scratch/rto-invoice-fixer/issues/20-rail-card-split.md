# 20: Rail/card split — list left, preview card right

**What to build:** move the per-file content out of the rail row into the right-hand preview card, matching the chosen prototype (ticket 11, variant D — the Inspector layout dressed in Fluent) and spec §6. Left rail: compact row per file — pass/fail dot, filename, ✕ remove; click selects the file (selected row visibly highlighted). Right pane: the selected file's card — header (filename + download icon top-right), details grid, totals facsimile (valid files), red refusal annotation (refused files), export/saved note. Selecting a rail row swaps the card; removing the selected file selects the next row (or the empty state when none remain). The upload block and ingest progress stay at the top of the rail; the cards pane shows the empty state when no file is selected.

**Blocked by:** 14, 15 (both done).

**Status:** ready-for-agent

- [ ] Rail rows are compact (dot, name, ✕); no details grid or facsimile in the rail
- [ ] Right pane shows exactly one card — the selected file's — with header (filename + download icon), details grid, facsimile/refusal, export note
- [ ] Click a rail row to select; selected row is visually distinct; selection survives re-render/ingest/export state changes
- [ ] Removing the selected file selects the neighbour; last removal returns to the identical empty state
