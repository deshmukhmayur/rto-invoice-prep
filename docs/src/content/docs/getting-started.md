---
title: Getting started
description: Download RTO Invoice Prep, install it on Windows, and prepare your first invoice in about two minutes.
---

import { Steps } from '@astrojs/starlight/components';
import { Aside } from '@astrojs/starlight/components';

## Download

[Download the latest release for Windows](https://github.com/deshmukhmayur/rto-invoice-prep/releases). The installer is
signed, roughly 90 MB, and works on Windows 10 and 11 (64-bit).

The latest release is always listed on the
[Releases page](https://github.com/deshmukhmayur/rto-invoice-prep/releases).
You will also see the version in the app's footer.

## Install

<Steps>
1. Run the installer you downloaded from the Releases page.
2. If Windows SmartScreen shows *Windows protected your PC*, click
   **More info** → **Run anyway**. The installer is unsigned by a
   certificate authority but comes straight from the official release page.
3. Follow the installer. RTO Invoice Prep installs per-user and adds a
   Start-menu shortcut — no administrator rights needed.
4. Launch **RTO Invoice Prep** from the Start menu.
</Steps>

## Prepare your first invoice

<Steps>
1. **Load the PDF.** Click *Open PDF* (or drag a file onto the window) and
   pick the tax invoice your OEM system printed.
2. **Review the discount.** The app shows the discount line it found —
   for example "Less: Dealer Discount ₹ 18,500". Check the amount against
   your own records.
3. **Pick a save location.** The default is the same folder as the
   original, with the suffix `-rto` added to the file name. Change it if
   you prefer.
4. **Save.** The corrected PDF is written next to your original; nothing
   is uploaded or stored anywhere else.

That's it. Total taxable value, GST amounts, and the amount in words are
recomputed on the corrected copy.
</Steps>

<Aside type="caution">
  Keep the original invoice file untouched. RTO Invoice Prep always writes
  a **new** PDF — it never edits your originals.
</Aside>

## Where your data lives

Nowhere. The app keeps nothing between sessions: no accounts, no saved
vehicles, no settings files. Each PDF is read from disk, processed in
memory, and saved where you choose. The only network activity is a check
for new releases.
