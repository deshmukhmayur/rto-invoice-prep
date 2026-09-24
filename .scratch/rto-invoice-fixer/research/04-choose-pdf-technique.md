# Research: Choose the PDF technique (ticket 04)

Method: parsed both sample PDFs' content streams with PyMuPDF (probe script run in session, 2026-09-23), measured font metrics against the original's draw positions, and read how the manual-edit tool rewrote the modified sample's stream.

## What the sample PDFs actually contain

- **Text ops are trivially regular.** `original.pdf` page 1 body text is all `BT / 1 0 0 1 x y Tm / (string) Tj / ET` blocks (122 `Tj`, zero `TJ`). Every draw is at an absolute position with a literal string. No kerning arrays, no text matrices with rotation/scaling, no clips.
- **Fonts are non-embedded standard-14** (`/F1`–`/F4`: Times-Roman, Helvetica ×4 variants). No subset fonts, no custom encodings. WinAnsi-safe; all editable strings are ASCII digits, commas, periods.
- **Images (logo, QR, emblem) are separate XObjects** (`Im0`–`Im2`), never touched by text edits. No annotations.
- **The discount row is a plain text op**: `(Discount)Tj` at `Tm 28 358.083`, `(1,780.00)Tj` at `Tm 555.214 358.083` (PDF coords, y from bottom). Rule lines are `re f` fill rectangles at their own coordinates, independent of the row.

## How the manual edit rewrote the modified sample

The `modified.pdf` content stream was regenerated in `TD/TJ` form by the edit tool (structure differs from the original), but its placements validate our math precisely:

- `5,028.56` drawn at x = 555.214 = 586.3 − width("5,028.56") in standard Helvetica 8pt.
- `65,930.00` drawn at x ≈ 550.8 ≈ 586.3 − width("65,930.00").
- I.e. the manual-edit tool itself right-aligns to right edge ≈ 586.3 using non-embedded Helvetica metrics — exactly the override's rule.
- It also left `0.00` (round-off) at the old `0.40` start position (left-aligned, 4.4pt gap on the right) and produced the grand-total typo `65.930.00` — confirming the map note that the tool must recompute, not replicate.
- The manual edit *deleted* the discount value op entirely but *kept* the "Discount" label; per the 2026-09-23 override, our tool empties both label and value strings instead.

## Technique decision: in-place content-stream surgery on the original

1. Decompress page 1's content stream; parse `BT…ET` blocks; locate ops by their absolute `Tm` coordinates (not by string match — `54,092.88` appears 3×: taxable value, "CGST on …", "SGST on …").
2. Empty the discount label and value strings.
3. Rewrite the affected amount strings, each drawn at `x = 586.3 − width(newString)` for its font (Helvetica / Helvetica-Bold, 8pt/9pt) — metrics from pdf-lib `StandardFonts` (`font.widthOfTextAtSize`), validated ±0.5pt against the original and exactly matching the manual edit's placements.
4. Re-compress the stream; everything else (images, rules, fonts, pages, metadata) is untouched bytes.

### pdf-lib feasibility

- pdf-lib exposes page content streams (`PDFRawStream`); decode (`decodePDFRawStream`), string-replace, re-serialize. Low-level but well-trodden; no other library needed.
- New/replaced text needs no pdf-lib `drawText` at all — replacement is pure string substitution inside the existing ops, so the original `Tf`/`Tm` context is preserved. Only emptying ops requires deleting/replacing string literals.
- pdf.js renders the result for preview; PyMuPDF (Python fallback stack) does the same surgery with even less ceremony if needed.

### Risks and mitigations

- **Future OEM template drift** (TJ arrays, subset fonts, different layout): pin a validator — fail loudly if the expected ops (discount row, totals block at known coordinates, non-embedded fonts) aren't found; never guess. Goes into the spec (ticket 08 territory).
- **Template variants across models/dealers**: the tool should locate rows by the label text ("Discount", "Taxable Value", …) within the totals block, not hard-coded y only, with coordinate sanity checks.
- **Multi-page**: all editable amounts sit on page 1; page 2 untouched.

## Conclusion

pdf-lib surgery is reliable **on this OEM's output** and reproduces the manual edit's mechanics exactly (same right-edge, same metrics, same op deletion style). The chosen stack (Electron + pdf.js + pdf-lib) is confirmed; the PyMuPDF fallback stays documented but is not needed for the observed format.