# 02 — Analyse the sample diff and pin the transformation rule

Sources: `.scratch/samples/original.pdf` (PDF 1.6) vs `.scratch/samples/modified.pdf` (PDF 1.4), both Oracle BI Publisher 12.2.1.3.0, 2 pages, letter.

Method: `pdftotext -layout` full-text diff; `pdfinfo` / `pdffonts` / `pdfimages -list`; decompressed content-stream inspection of both files.

## 1. What the manual edit changed (exhaustive, from the text diff)

Only one block of page 1 changed; the rest of both documents is byte-for-byte the same text.

| Field | Original | Modified |
|---|---|---|
| Discount (value) | `1,780.00` | **blanked** (label "Discount" kept, number deleted) |
| Taxable Value | `54,092.88` | `55,872.88` (= Sub Total) |
| CGST label | `CGST on 54,092.88` | `CGST on 55,872.88` (base in the label rewritten) |
| CGST amount | `4,868.36` | `5,028.56` |
| SGST label / amount | `SGST on 54,092.88` / `4,868.36` | `SGST on 55,872.88` / `5,028.56` |
| Ex Showroom Price | `63,829.60` | `65,930.00` |
| Net Amount | `63,829.60` | `65,930.00` |
| Grand Total | `63,829.60` | `65,930.00` |
| Round Off | `0.40` | `0.00` |
| Grand Total (after Round Off) | `63,830.00` | `65.930.00` (**manual-edit typo**: dots for commas) |
| Rupees-in-words | `Rupees Sixty Three Thousand Eight Hundred Thirty Only` | `Rupees Sixty fiveThousand nine Hundred Thirty Only` (inconsistent caps, missing space — hand-retyped) |

Untouched: invoice number, dates, chassis/engine/VIN, dealer and customer blocks, HSN, all page-2 content, and **all images** (the QR/barcode images are the same objects in both files — `pdfimages` shows identical object IDs, dimensions, and sizes).

## 2. The transformation rule (verified to the paisa)

Given the original's `Sub Total S` and discount `D`:

1. Set discount to zero (leave the label, delete the value).
2. `Taxable = S` (i.e. `S − 0`).
3. `CGST = SGST = round2(0.09 × Taxable)` — the label's base text is rewritten to match.
   - Check: `0.09 × 55,872.88 = 5,028.5592 → 5,028.56` ✓ (original: `0.09 × 54,092.88 = 4,868.3592 → 4,868.36` ✓).
4. `Ex Showroom Price = Net Amount = Grand Total = Taxable + CGST + SGST`.
   - Check: `55,872.88 + 5,028.56 × 2 = 65,930.00` ✓.
5. `Round Off = round(Grand Total) − Grand Total`; final total is the rounded value.
   - Check original: `63,829.60 → 0.40 → 63,830.00` ✓; modified: `65,930.00 → 0.00` ✓.
6. Regenerate the rupees-in-words line from the final total (the human's retyped version is itself malformed — "fiveThousand" — so the tool should generate it correctly).

In short: **the edit is exactly "recompute as if the discount were zero"**.

## 3. Rewrite vs rebuild — what the content streams show

The modified PDF is **not** a minimal surgical patch, and **not** a full rebuild:

- The page-1 content stream was **re-encoded wholesale**: the original uses absolute positioning (`1 0 0 1 x y Tm (text) Tj`), the modified uses relative `TD`/`TJ` runs at the same coordinates. Same fonts (`F2`=Helvetica 8, `F3`=Helvetica-Bold 8), same text positions to 2 decimals, same ruling rectangles (`re f`).
- Old number strings are **truly deleted** from the stream (`1,780.00`, `54,092.88`, `63,829.60` appear 0 times in modified), not covered by white rectangles — genuine redaction.
- All image XObjects are shared/identical between the two files.
- PDF header downgraded 1.6 → 1.4 (typical of many editors); Producer metadata string was left as Oracle BI Publisher.

Implication for ticket 04: an in-place text-layer rewrite with font/coordinate preservation (pdf-lib-style) reproduces this edit's character exactly — including its ability to leave the QR image objects untouched. A full regeneration is unnecessary and would discard image objects. The manual edit also proves the RTO tolerates a re-encoded text layer.

## 4. Surprises / cautions

- The manual edit **contains errors** (the `65.930.00` typo, the garbled words line). The tool should reproduce the *intent* (correct recomputed numbers, correctly spelled words), not the typos. Worth a line in the spec; the RTO clearly isn't parsing them.
- The discount **label row is kept** with a blank value — removing the whole row would shift layout and differ from the accepted edit.
- The CGST/SGST **label text embeds the taxable base** and must be rewritten too, not just the amount.
- Only one sample pair exists (single vehicle model, single discount amount); layout-variation risk is unquantified.
