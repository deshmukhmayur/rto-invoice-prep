# 02 - Analyse the sample diff and pin the transformation rule

Type: research (AFK)
Blocked by: 01
Status: resolved

## Question

Given `.scratch/samples/original.pdf` and `.scratch/samples/modified.pdf`:

1. Catalogue exactly what the manual edit changed — every field, its position, and its new value (removed discount line, rewritten taxable value, CGST/SGST lines, ex-showroom price, grand total, round-off, anything else such as QR codes or totals blocks).
2. Derive the transformation rule as math: given the original's extracted numbers, what formula reproduces the modified invoice's numbers exactly? Verify it matches to the paisa.
3. Note whether the edit is a text rewrite in place (surgery-friendly) or a rebuilt layout (regeneration-friendly).
4. List anything the edit leaves untouched (invoice number, dates, dealer/customer details, HSN, etc.) and anything surprising (e.g. QR code changes).

Record findings in a research note under `.scratch/rto-invoice-fixer/research/` and link it from this ticket.

Research note: [research/02-analyse-sample-diff.md](research/02-analyse-sample-diff.md)

## Answer

The manual edit is exactly "recompute as if the discount were zero": blank the discount value (label row kept), Taxable = Sub Total (55,872.88), CGST = SGST = round2(9% × Taxable) with the label's base text rewritten, Ex Showroom = Net = Grand Total = Taxable + CGST + SGST (65,930.00), Round Off = round(GT) − GT, and the rupees-in-words regenerated. Verified to the paisa against both invoices. Content-stream analysis: the text layer was re-encoded in place (same fonts/coordinates/images; old number strings truly deleted, not white-out) — a pdf-lib-style in-place rewrite reproduces this edit's character; no regeneration needed. All images (QR) and identity fields untouched. Notably the manual edit itself contains typos (`65.930.00`, garbled words line); the tool should produce correct values, not replicate the typos. Details: [research/02-analyse-sample-diff.md](research/02-analyse-sample-diff.md).

## Comments

- Resolved by wayfinder session, 2026-09-23. Unblocks 04. Graduated fog into tickets 08 (edge cases) and 09 (identity-content confirmation).
- Override (user, 2026-09-23): the tool will remove the **entire discount row** — the "Discount" label and any value text both emptied, not merely blanked-by-omission — rather than reproducing the sample's blank-value-but-label-kept layout. Refinement (same discussion): **empty the text strings, don't delete the operators** — replace `(Discount)Tj` and the value's `(…)Tj` with empty strings; rows below keep their absolute coordinates so nothing shifts, the ruling lines stay, and the ~9pt gap reads as a tidy empty row. Emptying is the minimal, lowest-risk stream edit (pure string substitution, structure intact, reversible). The exact visual treatment is confirmed; ticket 04 inherits this as its baseline.
- Requirement (user, 2026-09-23): the rewritten amount column must stay **right-aligned** with the untouched rows. In the sample every substituted amount keeps the same digit/separator pattern (`54,092.88 → 55,872.88`, `63,829.60 → 65,930.00`), so in-place substitution at the original x-position preserves alignment; but amounts with a different width (e.g. crossing a thousands boundary: `9,828.56 → 10,028.56`) would break it. The tool must therefore compute the new string's rendered width (font metrics for Helvetica 8 bold/plain are known and non-embedded) and adjust the x-position of each substituted `Tj` so the string's right edge lands on the original right edge — same rule for the totals block and any other rewritten amount.
