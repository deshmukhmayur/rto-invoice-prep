# 14: Ingest & validate

**What to build:** dropping or picking invoice PDFs produces reviewed rows. Upload block button + whole-window drag-and-drop (frosted-glass drag overlay), ingest progress ("Reading N of M…" determinate bar + one "reading `<filename>`…" spinner row per pending file), then one rail row per file: pass/fail dot, details grid (Invoice no., Customer, Invoice date, Model, Chassis no., Engine no.; `~unreadable~` for unparsable fields), and refusals per spec §4 — no-discount vs 0.00 distinguished, broken identity with observed numbers, multiple discount rows, template drift, unextractable field named. The op-pattern validator (totals-block row set/order, labels at sane coordinates, non-embedded standard fonts, 2 pages) fails loudly on drift. ✕ removes any row (valid or refused); back to empty shows the same first-launch empty state.

**Blocked by:** 13.

**Status:** done

- [x] Drop / File → Upload Invoice / upload block all ingest; drag-hover overlay and ingest placeholders behave per spec §6
- [x] Sample `original.pdf` passes validation; every §4 refusal case is demonstrated with a synthetic/hand-made variant and shows its named-field message
- [x] Validator fails loudly on a deliberately mutated stream (TJ array, moved row, or subset font)
- [x] ✕ on any row returns to the identical empty state
