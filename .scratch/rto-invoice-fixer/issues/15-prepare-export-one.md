# 15: Prepare & export one file

**What to build:** the transformation, end to end. For a validated file: pdf-lib content-stream surgery per spec §2/§3 — empty the Discount label + value strings, rewrite Taxable/CGST/SGST/Ex-showroom/Net/Round-off/Grand-total amounts and the CGST/SGST label base text at `x = 586.3 − width(newString)` (pdf-lib standard Helvetica metrics), regenerate the rupees-in-words correctly — then write the result via the save dialog (default `<original>-RTO.pdf`, no filename input on the card), adding only the custom metadata (tool name, version, timestamp, modification description) and leaving originals untouched. The card shows the details grid + totals facsimile (Discount struck "✕ removed", old struck → new amber-highlighted, words row old → new) with a download icon.

**Blocked by:** 14.

**Status:** done

- [x] Preparing `.scratch/samples/original.pdf` reproduces §2's worked example to the paisa, including the words line
- [x] Output opens in pdf.js identical to the original except the totals block; image objects, ruling lines, page 2, and original metadata are byte-identical
- [x] Right-alignment holds for a thousands-boundary-crossing amount (e.g. `9,828.56 → 10,028.56`), not just same-width substitutions
- [x] Per-file Download writes `<original>-RTO.pdf` to a chosen folder; the original file is never touched
