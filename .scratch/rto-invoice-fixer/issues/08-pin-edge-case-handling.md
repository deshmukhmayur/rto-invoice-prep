# 08 - Pin edge-case handling for invoice variants

Type: grilling (HITL)
Status: resolved

## Question

The sample diff (ticket 02) validated the transformation on one invoice (one model, one discount, CGST/SGST at 9%). Pin how v1 handles variants, with the dealership employee or by inspecting more sample invoices:

- Invoice with **no discount** (nothing to remove) — pass-through or reject?
- Extra line items between Sub Total and Taxable Value (insurance, road tax, TCS) — does the discount-zero recomputation still hold, or are these lines also affected?
- Multiple discount lines or a discount of 0.00.
- Layout variation across vehicle models / invoice generations (field labels at different coordinates, one-page vs two-page).
- Missing or unextractable numbers: what does the tool do when it can't find the expected fields?

Decide v1's stance (likely: detect-and-refuse rather than guess), and whether a second sample pair is needed before the spec locks the extraction rules. Consult the `grilling` and `domain-modeling` skills.

## Answer

v1's stance is **detect-and-refuse** everywhere; it never guesses and never emits partial or degraded output. Pinned:

1. **No discount** — refuse with a message distinguishing the two cases: "no Discount row found" vs "Discount is 0.00". Pass-through is rejected because the tool's single purpose is removing a discount; a discountless invoice means wrong file or already-prepared, and silently passing it through risks filing an unprocessed invoice as an RTO invoice.
2. **Extra line items between Sub Total and Taxable Value** — refuse. The tool validates the identity `round2(Sub Total − Discount) = Taxable Value` and the exact row set/order of the sample's totals block (Sub Total → Discount → Taxable Value → CGST on X → SGST on X → Ex Showroom Price → Net Amount → Grand Total → Round Off → Grand Total after Round Off). A mismatch or an extra row (insurance, road tax, TCS, accessories) is refused with the observed numbers in the message; no generalized recomputation.
3. **Multiple discount lines** — refuse. Exactly one row labelled `Discount` is required.
4. **Layout variation** — strict template match only (same labels, same block layout, 2 pages like the sample). Anything failing the op-pattern validator from ticket 04 is refused; no fuzzy or best-effort matching. Broadening happens only when a real variant invoice is available and the spec is extended.
5. **Missing/unextractable numbers** — refuse, naming the missing field (e.g. "Taxable Value amount not found"). Extraction failure is a refusal, never degraded output.

**Second sample pair: not needed before the spec locks.** None is obtainable before tomorrow; the extraction rules are written as "validated against this one template; refuse otherwise", which is safe with a single sample. Verification against a real variant is deferred until one is obtainable.

## Comments

- Resolved by wayfinder session, 2026-09-23. All five stances accepted by the user (detect-and-refuse). Unblocks 07.
