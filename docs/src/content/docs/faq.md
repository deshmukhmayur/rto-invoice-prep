---
title: FAQ
description: Answers to common questions about RTO Invoice Prep — privacy, supported invoices, GST, and troubleshooting.
sidebar:
  order: 4
---

import { Aside } from '@astrojs/starlight/components';

## Privacy & data

### Does the app send my invoices anywhere?

No. Every invoice is read from disk and processed in memory on your
computer. The only network activity is a check for newer releases.

### Does it store anything between sessions?

No. RTO Invoice Prep is fully stateless: no accounts, no saved vehicles, no
settings files, no history. Close the app and everything from that session
is gone.

### Can I use it on a shared dealership computer?

Yes. Since nothing is saved, there's no profile or history to clean up
before you hand the keyboard to the next person.

## Invoices & GST

### Which invoices does it work on?

The standard OEM tax invoice (the "Tax Invoice" PDF printed by the
manufacturer's system for two-wheelers). Not the purchase order, the
delivery note, or your dealership's own challan.

### My invoice doesn't have a discount line. Can I still use it?

Yes — just load it and check that the detected discount is zero. If it is,
the original PDF already adds up and there's nothing to change; you can
hand over the original.

### What GST rate does the app use?

Whatever rate is printed on your invoice. Most two-wheelers use CGST 14% +
SGST 14%, and the app reads that from the PDF itself rather than assuming
a fixed rate.

### Does the corrected copy include the amount in words?

Yes. The app rewrites the amount in words for the new grand total in Indian
numbering (lakhs and crores).

### Is the corrected copy legally valid?

The app removes the discount line and rewrites the totals so the figures
add up. Whether the RTO office accepts that copy is between you and your
OEM — many dealerships use this exact workflow, but check with your OEM
representative if you're unsure.

## Troubleshooting

### The app says "Discount line not found"

See the [troubleshooting section of the user guide](/guide/#troubleshooting)
for the common causes and fixes.

### The amounts don't match my invoice

Re-open the PDF and verify the discount amount digit by digit, then check
the GST rates printed on the invoice. If your invoice uses a structure the
app doesn't understand, treat the output as a starting point and verify by
hand.

### The app won't start

Install the latest release from the
[Releases page](https://github.com/deshmukhmayur/rto-invoice-prep/releases).
If Windows SmartScreen blocks the first run, click **More info** →
**Run anyway**.

## Reporting bugs

Open an issue using the
[bug report template](https://github.com/deshmukhmayur/rto-invoice-prep/issues/new?template=bug_report.yml).
Please include:

- the app version (shown in the footer),
- your Windows version,
- a **redacted** copy of the invoice PDF — black out the chassis number,
  engine number, customer name, and any personal details before attaching.

<Aside type="caution">
  Never attach an un-redacted tax invoice to a public GitHub issue. Chassis
  and engine numbers are sensitive.
</Aside>

## Updates

### How do I know a new version is out?

The app checks for releases when it starts and shows a notification when a
newer version is available. You can also watch the
[Releases page](https://github.com/deshmukhmayur/rto-invoice-prep/releases).

### Is it free?

Yes. RTO Invoice Prep is free and open source.
