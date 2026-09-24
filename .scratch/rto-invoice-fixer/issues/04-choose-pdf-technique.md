# 04 - Choose the PDF technique

Type: research (AFK)
Blocked by: 02
Status: resolved

## Question

In-place surgery (white-out the discount row, rewrite totals text at the same coordinates) vs regeneration (extract all fields, recalculate, render a fresh PDF). The sample diff (ticket 02) shows what the manual edit actually does; this ticket evaluates whether the chosen stack's PDF tooling (see ticket 03) can do that reliably on OEM PDFs — text replacement with matching fonts/positions, redaction, or rebuild. Decision criterion: output must look like and contain exactly what the RTO-accepted manual edit produces.

Record findings in a research note under `.scratch/rto-invoice-fixer/research/` and link it from this ticket.

## Answer

In-place **content-stream surgery on the original PDF**, confirmed viable by direct inspection of both samples (findings: [research/04-choose-pdf-technique.md](../research/04-choose-pdf-technique.md)):

- The original's page-1 text is all simple absolute-position `(string)Tj` ops in non-embedded standard-14 fonts; amounts are located by `Tm` coordinates, not string match.
- The technique: decompress the stream, empty the discount label+value strings, rewrite the affected amounts at `x = 586.3 − width(newString)` using pdf-lib's standard Helvetica metrics. Validated: the manual edit itself placed its rewritten amounts at exactly that formula (±0.5pt), and the original's own draws match it too.
- pdf-lib can do this via `PDFRawStream` decode/replace; pdf.js previews the result; images/rules/pages untouched.
- Risks (template drift, variants) mitigated by an op-pattern validator that fails loudly — to be pinned in the spec. The PyMuPDF fallback stack stays documented but is not required for the observed format.
