---
title: User guide
description: How to load, verify, and save corrected invoices with RTO Invoice Prep.
sidebar:
  order: 3
---

import { Steps, Aside, Tabs, TabItem } from '@astrojs/starlight/components';

## The workflow

<Steps>
1. **Open** — click *Open PDF* or drag the tax invoice onto the window.
2. **Verify** — check the detected invoice details and the discount amount
   against your own copy of the invoice.
3. **Save** — choose where the corrected file goes and click *Save PDF*.
</Steps>

The whole loop takes a couple of minutes per invoice. There are no settings
to configure and no data is kept between sessions — every invoice starts
from a clean slate.

<Aside type="note">
  RTO Invoice Prep works on the **OEM tax invoice** (the "Tax Invoice"
  printed by the manufacturer's system), not on the purchase order, the
  delivery note, or your dealership's own challan.
</Aside>

## What the app removes

OEM tax invoices carry a line such as:

> Less: Dealer Discount ₹ 18,500

That discount was already settled between you and the OEM. When the RTO
office sees it on the registration copy, they ask for paperwork you don't
have — so the line has to come off. RTO Invoice Prep removes:

- the **discount amount** from the discount line,
- the discount's share of **taxable value**, CGST, and SGST,
- stale **totals** and **rounding** figures, and
- the **amount in words**, rewritten for the new total.

Everything else on the invoice — chassis number, engine number, vehicle
description, HSN, dealer details, taxes actually collected — stays exactly
as the OEM printed it.

## What the app recalculates

RTO Invoice Prep recomputes the money figures from the remaining taxable
value using the GST rates shown on the invoice itself:

- **Total taxable value** = price − discount.
- **CGST / SGST** = taxable value × the rate printed on your invoice
  (typically 14% + 14% for most two-wheelers, or 18% split evenly for
  standard vehicles).
- **Grand total** = taxable value + CGST + SGST − pre-paid amount, then
  **rounded** to the nearest rupee.
- **Amount in words** = the rounded grand total, spelled out in Indian
  numbering (e.g. "Rupees One Lakh Twelve Thousand Three Hundred Forty Five
  Only").

If the invoice shows a different GST structure, the app still uses the
rates **printed on that invoice**, so the corrected copy always matches the
tax your OEM actually collected.

## Saving the corrected file

The default save location is the same folder as the original, with the
suffix `-rto` appended:

```
invoice.pdf       →  invoice-rto.pdf
```

<Aside type="caution">
  The app refuses to overwrite your original file. If you pick a name that
  collides with an existing PDF, it asks you to choose another.
</Aside>

## Troubleshooting

### "Discount line not found"

The PDF's discount line doesn't match the pattern the app looks for — for
example, the dealer wrote the amount without a currency symbol or the
layout is a non-OEM template.

- Check that the invoice is the OEM tax invoice (not the purchase order).
- If the discount is genuinely zero, save nothing and hand over the
  original.
- If your layout really is different, [file a bug](/faq/#reporting-bugs)
  with a redacted copy of the invoice.

### "Amount in words mismatch"

The app's computed total doesn't match what the invoice says in words. This
happens when:

- the discount amount you entered differs from the amount on the PDF,
- your invoice uses a different GST rate than the standard one.

Re-open the PDF, verify the discount amount digit by digit, and check the
GST rates printed on the invoice. If the mismatch persists, the OEM may
have used an unusual structure — treat the output as a starting point and
verify by hand before submission.

### The app won't open

- Make sure you installed the latest release from the
  [Releases page](https://github.com/deshmukhmayur/rto-invoice-prep/releases).
- If Windows SmartScreen blocks the first run, click **More info** →
  **Run anyway**.
- If it still won't start, [report the bug](/faq/#reporting-bugs) with your
  Windows version and the release you downloaded.

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Open PDF | `Ctrl+O` |
| Save PDF | `Ctrl+S` |
| Reset / load a new invoice | `Ctrl+R` |
