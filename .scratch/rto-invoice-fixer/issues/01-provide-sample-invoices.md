# 01 - Provide sample invoices

Type: task (HITL)
Status: resolved

## Question

The dev drops real PDFs into the repo so analysis agents can work from ground truth:

- `.scratch/samples/original.pdf` — the OEM portal's invoice with the discount applied
- `.scratch/samples/modified.pdf` — the same invoice after the manual edit (RTO-accepted version)

If possible, 2–3 invoice pairs from different vehicle models / discount amounts strengthens the transformation rule; one pair is the minimum.

## Answer

One invoice pair delivered at `.scratch/samples/` (minimum viable, no extra model/discount variants):

- `original.pdf` — OEM portal invoice, PDF 1.6, 2 pages, producer Oracle BI Publisher 12.2.1.3.0
- `modified.pdf` — manually edited (RTO-accepted) counterpart, PDF 1.4, 2 pages, same producer

Both non-tagged, no custom metadata stream. Ready as ground truth for ticket 02 (analyse sample diff). If diff analysis later needs more pairs from other models/discount amounts, that becomes a follow-up drop.
