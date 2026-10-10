# 17: Logging

**What to build:** the audit trail. Global append-only monthly logs at `%APPDATA%\rto-invoice-prep\logs\rto-invoice-prep-YYYY-MM.log` (created on first write of the month; per batch: timestamp, input → extracted → recalculated → output path; refusals with reasons; `FAILED` and `ERROR` lines). The tool never rotates away or auto-deletes logs. The "Log — this session" modal shows the session's lines (OK plain, REFUSED/FAILED red, ERROR for crashes) with an empty state ("Nothing logged yet…" + monthly-file reminder) and icon buttons: Open Folder (`shell.openPath` on the logs dir, tooltip carries the month file) and Download (save-dialog copy).

**Blocked by:** 15.

**Status:** done

- [x] Every ingest, refusal, export, failure, and crash appends to the monthly file in the specified shape
- [x] Session log modal renders all line kinds plus the empty state; Open Folder opens the logs dir, Download saves a copy
- [x] No code path deletes or truncates a log file
