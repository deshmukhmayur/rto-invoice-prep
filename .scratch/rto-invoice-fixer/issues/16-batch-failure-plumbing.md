# 16: Batch & failure plumbing

**What to build:** the batch loop and every failure state around it. Toolbar export combo ("Export N files" + ▾ "Export as Zip" with `rto-invoices-YYYY-MM-DD.zip` prefilled in the dialog); output directory as a folder-picker button defaulting to Downloads. Failure states per spec §6: refused-only batch → "Nothing to export" (disabled) + red summary strip; unwritable/not-set folder → red ⚠ picker, "Export blocked", Pick-another-folder banner; mid-batch write failure → Saved ✓ on completed rows, Write failed + red panel naming the error + Retry this file on the failed row; parser crash → hollow red dot, gray error panel with Open Log / Report a bug, never a silent row. Log writes OK / REFUSED / FAILED / ERROR lines (the log file and its modal may be minimal here; ticket 17 completes them).

**Blocked by:** 15.

**Status:** ready-for-agent**

- [ ] Batch of N files exports N PDFs, plus a zip named `rto-invoices-YYYY-MM-DD.zip` via the combo's dropdown
- [ ] Each §6 failure state is demonstrated (unwritable folder, refused-only, simulated write failure with retry, simulated crash) and each message names the file/field with a next action
- [ ] Retry re-writes only the failed file; completed rows keep their Saved ✓ tag
