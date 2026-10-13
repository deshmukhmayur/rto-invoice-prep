import type { AppVersions } from "../shared/app";
import type {
  BatchFileResult,
  ExportResult,
  LogTotals,
  ParsedRow,
} from "../shared/ingest";
import { emptyDetails } from "../shared/ingest";
import type { LogLine } from "../shared/log";
import { formatAmount, parseAmount, recomputeTotals, rupeesInWords } from "../shared/totals";
import "./app-api";

const APP_LINKS = {
  website: "https://deshmukhmayur.github.io/rto-invoice-prep/",
  docs: "https://deshmukhmayur.github.io/rto-invoice-prep/docs/",
  repo: "https://github.com/deshmukhmayur/rto-invoice-prep",
  bugTemplate: "https://github.com/deshmukhmayur/rto-invoice-prep/issues/new?template=bug_report.yml",
  featureTemplate: "https://github.com/deshmukhmayur/rto-invoice-prep/issues/new?template=feature_request.yml",
};

type RailRow = ParsedRow & {
  id: number;
  data: ArrayBuffer;
  export?: ExportResult;
  batch?: BatchFileResult;
  retrying?: boolean;
};

let nextId = 1;
let rows: RailRow[] = [];
let selectedId: number | null = null;
let ingest: { total: number; done: number; pending: string[] } | null = null;
let outDir: string | null = null;
let dirBlock: { reason: string } | null = null;
let batchSummary: { kind: "ok" | "error"; text: string } | null = null;
let zipMenuOpen = false;
let exporting = false;
type ModalKind = "log" | "guide" | "about";
let modal: ModalKind | null = null;
let logModal: { lines: LogLine[] | null; savedTo: string | null } = {
  lines: null,
  savedTo: null,
};
let versions: AppVersions | null = null;
void window.app.versions().then((v) => {
  versions = v;
  renderModal();
});

const modalRoot = document.getElementById("modal-root")!;

let monthFile: string | null = null;
void window.app.logMonthFile().then((name) => {
  monthFile = name;
});

void window.app.defaultFolder().then((dir) => {
  outDir = dir;
  render();
});

const main = document.querySelector("main")!;

function removeRow(id: number): void {
  const index = rows.findIndex((r) => r.id === id);
  rows = rows.filter((r) => r.id !== id);
  if (selectedId === id) {
    selectedId = rows.length === 0 ? null : rows[Math.min(index, rows.length - 1)]!.id;
  }
}

function validRows(): RailRow[] {
  return rows.filter((r) => r.status === "valid");
}

function render(): void {
  const empty = rows.length === 0 && !ingest;
  if (empty) {
    main.innerHTML = emptyStateHtml();
    document.getElementById("empty-upload")?.addEventListener("click", pickAndIngest);
    return;
  }
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  main.innerHTML = `
    <div class="layout">
      <aside class="rail" id="rail">
        <button class="upload-block" id="upload-block" type="button">
          <span class="upload-block-title">Upload invoices</span>
          <span class="upload-block-sub">or drop PDFs anywhere in this window</span>
        </button>
        ${ingest ? ingestProgressHtml() : ""}
        ${rows.map(rowHtml).join("")}
        ${!ingest && rows.length > 0 && rows.every((r) => r.status !== "valid")
          ? `<div class="refused-strip" role="alert">No file in this batch can be exported (refused or unreadable). Remove the files or upload different ones.</div>`
          : ""}
        ${exportBarHtml()}
      </aside>
      <section class="cards" id="cards">
        ${selected ? cardHtml(selected) : cardsEmptyHtml()}
      </section>
    </div>`;

  document.getElementById("upload-block")?.addEventListener("click", pickAndIngest);
  const fill = main.querySelector<HTMLElement>(".ingest-bar-fill[data-fill]");
  if (fill && ingest) fill.style.width = `${Math.round((ingest.done / ingest.total) * 100)}%`;
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-remove]")) {
    btn.addEventListener("click", () => {
      removeRow(Number(btn.dataset.remove));
      render();
    });
  }
  const selectRow = (id: number): void => {
    if (selectedId === id) return;
    selectedId = id;
    render();
  };
  for (const rowEl of main.querySelectorAll<HTMLElement>("[data-row]")) {
    rowEl.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-remove]")) return;
      selectRow(Number(rowEl.dataset.row));
    });
    rowEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      selectRow(Number(rowEl.dataset.row));
    });
  }
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-export]")) {
    btn.addEventListener("click", () => void exportOne(Number(btn.dataset.export)));
  }
  document.getElementById("folder-picker")?.addEventListener("click", () => void pickFolder());
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-pick-folder]")) {
    btn.addEventListener("click", () => void pickFolder());
  }
  document.getElementById("export-batch")?.addEventListener("click", () => void exportBatch());
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-jump]")) {
    btn.addEventListener("click", () => {
      const target = rows.find((r) => r.status !== "valid") ?? rows[0];
      if (!target) return;
      selectedId = target.id;
      render();
      main.querySelector<HTMLElement>(`[data-row="${target.id}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }
  document.getElementById("zip-caret")?.addEventListener("click", () => {
    zipMenuOpen = !zipMenuOpen;
    render();
  });
  if (zipMenuOpen) {
    setTimeout(() => {
      document.addEventListener("click", closeZipMenuOnOutsideClick);
      document.addEventListener("keydown", closeZipMenuOnEscape);
    });
  }
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-export-zip]")) {
    btn.addEventListener("click", () => void exportZip());
  }
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-retry]")) {
    btn.addEventListener("click", () => void retryOne(Number(btn.dataset.retry)));
  }
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-open-log]")) {
    btn.addEventListener("click", () => void openLogModal());
  }
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-report-bug]")) {
    btn.addEventListener("click", () => void window.app.reportBug());
  }
}

function closeZipMenuOnOutsideClick(e: MouseEvent) {
  const target = e.target as Node;
  const menu = document.querySelector(".export-menu");
  const caret = document.getElementById("zip-caret");
  if (menu?.contains(target) || caret?.contains(target)) return;
  zipMenuOpen = false;
  document.removeEventListener("click", closeZipMenuOnOutsideClick);
  document.removeEventListener("keydown", closeZipMenuOnEscape);
  render();
}

function closeZipMenuOnEscape(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  zipMenuOpen = false;
  document.removeEventListener("click", closeZipMenuOnOutsideClick);
  document.removeEventListener("keydown", closeZipMenuOnEscape);
  render();
}

function cardsEmptyHtml(): string {
  return `
    <div class="cards-empty">
      <svg width="32" height="32" viewBox="0 0 16 16" aria-hidden="true">
        <path fill="currentColor" d="M3 1.5A1.5 1.5 0 0 0 1.5 3v10A1.5 1.5 0 0 0 3 14.5h10A1.5 1.5 0 0 0 14.5 13V5.5a1.5 1.5 0 0 0-1.5-1.5H8.2L6.6 2.3A1.5 1.5 0 0 0 5.6 1.5H3z"/>
      </svg>
      <p>Select a file on the left to see its details</p>
    </div>`;
}

async function exportOne(id: number): Promise<void> {
  const row = rows.find((r) => r.id === id);
  if (!row || row.status !== "valid") return;
  const btn = main.querySelector<HTMLButtonElement>(`[data-export="${id}"]`);
  if (btn) btn.disabled = true;
  const result = await window.app.exportOne({ fileName: row.fileName, data: row.data, logTotals: logTotalsFor(row) });
  row.export = result;
  render();
}

function zipNameForToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `rto-invoices-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}

function exportBarHtml(): string {
  const valid = validRows();
  const n = valid.length;
  const attention = rows.filter((r) => r.status !== "valid").length;
  const pendingCount = ingest ? ingest.pending.length : 0;
  const folderLabel = outDir
    ? outDir.split(/[\\/]/).filter(Boolean).pop() || outDir
    : "Choose output folder";

  const segments = [
    ...rows.map((r) => `<span class="seg ${r.status === "valid" ? "ready" : r.status === "error" ? "crashed" : "blocked"}" title="${escapeHtml(r.fileName)}"></span>`),
    ...Array.from({ length: pendingCount }, (_, i) => `<span class="seg reading" title="${escapeHtml(ingest!.pending[i] ?? "")}"></span>`),
  ].join("");
  const meter =
    segments.length > 0
      ? `<button class="tally" type="button" data-jump title="Show the first file that needs attention">${segments}</button>`
      : "";

  let note: string;
  if (dirBlock) {
    note = `<div class="tally-note error" role="alert"><span>Can't write to the output folder — ${escapeHtml(dirBlock.reason)}</span><button type="button" class="tally-note-action" data-pick-folder>Pick another folder</button></div>`;
  } else if (batchSummary) {
    note = `<div class="tally-note ${batchSummary.kind}" role="status">${escapeHtml(batchSummary.text)}</div>`;
  } else {
    note = `<div class="tally-note">${rows.length + pendingCount} file${rows.length + pendingCount === 1 ? "" : "s"} · ${
      pendingCount > 0
        ? "reading…"
        : attention === 0
          ? "all ready"
          : `${attention} need${attention === 1 ? "s" : ""} attention`
    }</div>`;
  }

  const primary =
    n === 0
      ? `<button class="export-primary" id="export-batch" type="button" disabled>Nothing to export</button>`
      : `<button class="export-primary" id="export-batch" type="button" ${exporting ? "disabled" : ""}>${exporting ? "Exporting…" : `Export ${n} file${n === 1 ? "" : "s"}`}</button>`;

  return `
    <footer class="rail-footer">
      <div class="batch-bar">
        <div class="tally-group">
          ${meter}
          ${note}
        </div>
        <div class="bar-actions">
          <label class="save-to">Save to</label>
          <button class="folder-picker${dirBlock ? " blocked" : ""}" id="folder-picker" type="button" title="${escapeHtml(outDir ?? "Choose output folder")}">
            ${dirBlock ? `<span class="warn" aria-hidden="true">⚠</span>` : folderIcon()}
            <span class="folder-path">${escapeHtml(folderLabel)}</span>
          </button>
          <div class="export-combo">
            ${primary}
            <button class="zip-caret" id="zip-caret" type="button" ${n === 0 || exporting ? "disabled" : ""} title="More export options" aria-haspopup="menu" aria-expanded="${zipMenuOpen}">▾</button>
            ${zipMenuOpen
              ? `<div class="export-menu" role="menu"><button type="button" data-export-zip role="menuitem">Export as Zip</button></div>`
              : ""}
          </div>
        </div>
      </div>
    </footer>`;
}

function folderIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h2.6c.4 0 .78.16 1.06.44l1.06 1.06c.1.1.23.15.35.15H13A1.5 1.5 0 0 1 14.5 4.5v8A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5V3z"/></svg>`;
}

async function pickFolder(): Promise<void> {
  const dir = await window.app.pickFolder();
  if (dir) {
    outDir = dir;
    dirBlock = null;
    batchSummary = null;
  }
  render();
}

async function ensureFolder(): Promise<boolean> {
  if (!outDir) {
    dirBlock = { reason: "no output folder is set" };
    render();
    return false;
  }
  const check = await window.app.checkFolder(outDir);
  if (!check.ok) {
    dirBlock = { reason: check.reason ?? "the output folder is not writable" };
    render();
    return false;
  }
  return true;
}

function applyBatchResults(results: BatchFileResult[]): void {
  // Results arrive in the order the files were sent.
  const targets = validRows();
  results.forEach((res, i) => {
    const row = targets[i];
    if (row) row.batch = res;
  });
}

async function exportBatch(): Promise<void> {
  if (exporting) return;
  if (!(await ensureFolder())) return;
  const targets = validRows();
  if (targets.length === 0) return;
  exporting = true;
  batchSummary = null;
  render();
  const results = await window.app.exportBatch({
    dir: outDir!,
    files: targets.map((r) => ({ fileName: r.fileName, data: r.data, logTotals: logTotalsFor(r) })),
  });
  applyBatchResults(results);
  const failed = results.filter((r) => r.status === "error");
  batchSummary =
    failed.length === 0
      ? { kind: "ok", text: `Saved ${results.length} file${results.length === 1 ? "" : "s"} to ${outDir}` }
      : {
          kind: "error",
          text: `${failed.length} of ${results.length} files failed to write — use Retry this file on the failed row${failed.length === 1 ? "" : "s"}.`,
        };
  exporting = false;
  render();
}

async function exportZip(): Promise<void> {
  if (exporting) return;
  if (!(await ensureFolder())) return;
  const targets = validRows();
  if (targets.length === 0) return;
  zipMenuOpen = false;
  exporting = true;
  batchSummary = null;
  render();
  const result = await window.app.exportZip({
    dir: outDir!,
    zipName: zipNameForToday(),
    files: targets.map((r) => ({ fileName: r.fileName, data: r.data, logTotals: logTotalsFor(r) })),
  });
  batchSummary =
    result.status === "saved"
      ? { kind: "ok", text: `Saved ${result.path}` }
      : {
          kind: "error",
          text:
            result.status === "refused"
              ? `Zip export refused — ${result.reason}`
              : result.status === "error"
                ? `Zip export failed — ${result.reason}`
                : "Zip export canceled",
        };
  exporting = false;
  render();
}

async function retryOne(id: number): Promise<void> {
  const row = rows.find((r) => r.id === id);
  if (!row || row.status !== "valid" || row.retrying) return;
  if (!(await ensureFolder())) return;
  row.retrying = true;
  batchSummary = null;
  render();
  const [result] = await window.app.exportBatch({
    dir: outDir!,
    files: [{ fileName: row.fileName, data: row.data, logTotals: logTotalsFor(row) }],
  });
  if (result) {
    row.batch = result;
    batchSummary =
      result.status === "saved"
        ? { kind: "ok", text: `Saved ${row.fileName} to ${outDir}` }
        : { kind: "error", text: `Retry failed for ${row.fileName} — ${result.reason}` };
  }
  row.retrying = false;
  render();
}

function emptyStateHtml(): string {
  return `
    <div class="empty-state" id="empty-state">
      <svg width="40" height="40" viewBox="0 0 16 16" aria-hidden="true">
        <path fill="currentColor" d="M3 1.5A1.5 1.5 0 0 0 1.5 3v10A1.5 1.5 0 0 0 3 14.5h10A1.5 1.5 0 0 0 14.5 13V5.5a1.5 1.5 0 0 0-1.5-1.5H8.2L6.6 2.3A1.5 1.5 0 0 0 5.6 1.5H3z"/>
        <path fill="#fff" d="M8 6a.6.6 0 0 1 .6.6v2.3l.9-.9a.6.6 0 1 1 .85.85l-2 2a.6.6 0 0 1-.85 0l-2-2a.6.6 0 1 1 .85-.85l.9.9V6.6A.6.6 0 0 1 8 6z"/>
      </svg>
      <h2>No invoices yet</h2>
      <p>Drop PDFs anywhere in this window, use <b>File → Upload Invoice</b>,<br>or the button below.</p>
      <button class="empty-upload" id="empty-upload" type="button">Upload invoices</button>
      <p class="stateless">Nothing is stored between sessions — the batch lives only in this window.</p>
    </div>`;
}

function ingestProgressHtml(): string {
  if (!ingest) return "";
  return `
    <div class="ingest-progress">
      <div class="ingest-progress-label">Reading ${Math.min(ingest.done + 1, ingest.total)} of ${ingest.total}…</div>
      <div class="ingest-bar"><div class="ingest-bar-fill" data-fill></div></div>
    </div>
    ${ingest.pending
      .map(
        (name) => `
      <div class="rail-row pending">
        <span class="spinner" aria-hidden="true"></span>
        <span class="row-name">reading ${escapeHtml(name)}…</span>
      </div>`,
      )
      .join("")}`;
}

function rowHtml(row: RailRow): string {
  const dot = row.status === "valid" ? "pass" : row.status === "error" ? "crash" : "fail";
  const tag =
    row.batch?.status === "saved"
      ? `<span class="tag saved">Saved ✓</span>`
      : row.batch?.status === "error"
        ? `<span class="tag failed">Write failed</span>`
        : "";
  const selected = row.id === selectedId;
  return `
    <div class="rail-row${selected ? " selected" : ""}" data-row="${row.id}" role="button" tabindex="0" aria-pressed="${selected}" aria-label="${escapeHtml(row.fileName)}">
      <div class="row-head">
        <span class="dot ${dot}" title="${row.status}"></span>
        <span class="row-name" title="${escapeHtml(row.fileName)}">${escapeHtml(row.fileName)}</span>
        ${tag}
        <button class="remove" type="button" data-remove="${row.id}" title="Remove ${escapeHtml(row.fileName)}" aria-label="Remove ${escapeHtml(row.fileName)}">✕</button>
      </div>
    </div>`;
}

function cardHtml(row: RailRow): string {
  const download = row.status === "valid" ? `
    <button class="download" type="button" data-export="${row.id}" title="Download prepared invoice" aria-label="Download prepared invoice">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5a.6.6 0 0 1 .6.6v7.44l2.72-2.72a.6.6 0 1 1 .85.85l-3.75 3.75a.6.6 0 0 1-.85 0L3.82 7.67a.6.6 0 1 1 .85-.85l2.72 2.72V2.1A.6.6 0 0 1 8 1.5zM2.5 13.4a.6.6 0 0 1 .6-.6h9.8a.6.6 0 1 1 0 1.2H3.1a.6.6 0 0 1-.6-.6z"/></svg>
    </button>` : "";
  const refused = row.status === "refused" ? `
    <div class="refusal-reason" role="alert">${escapeHtml(row.refusalReason ?? "Refused")}</div>` : "";
  const crashed = row.status === "error" ? crashPanelHtml(row) : "";
  const writeFail = row.batch?.status === "error" ? writeFailHtml(row) : "";
  const details =
    row.status === "error"
      ? ""
      : `<dl class="details-grid">
          ${detailCell("Invoice no.", row.details.invoiceNo)}
          ${detailCell("Invoice date", row.details.invoiceDate)}
          ${detailCell("Customer", row.details.customer)}
          ${detailCell("Model", row.details.model)}
          ${detailCell("Chassis no.", row.details.chassisNo)}
          ${detailCell(row.details.engineLabel === "Motor#" ? "Motor no." : "Engine no.", row.details.engineNo)}
        </dl>`;
  return `
    <div class="card">
      <div class="card-head">
        <span class="card-name" title="${escapeHtml(row.fileName)}">${escapeHtml(row.fileName)}</span>
        ${download}
      </div>
      ${details}
      ${facsimileHtml(row)}
      ${refused}
      ${crashed}
      ${writeFail}
      ${exportNoteHtml(row)}
    </div>`;
}

function crashPanelHtml(row: RailRow): string {
  return `
    <div class="crash-panel" role="alert">
      <div class="crash-title">The parser crashed on this file</div>
      <p class="crash-msg">${escapeHtml(row.errorReason ?? "Unexpected error")}</p>
      <p class="crash-file">File: ${escapeHtml(row.fileName)}</p>
      <div class="crash-actions">
        <button type="button" data-open-log>Open Log</button>
        <button type="button" data-report-bug>Report a bug</button>
      </div>
    </div>`;
}

function writeFailHtml(row: RailRow): string {
  return `
    <div class="write-fail" role="alert">
      <div class="write-fail-msg">Write failed for <b>${escapeHtml(row.fileName)}</b>: ${escapeHtml(row.batch?.status === "error" ? row.batch.reason : "")}</div>
      <button class="retry" type="button" data-retry="${row.id}" ${row.retrying ? "disabled" : ""}>${row.retrying ? "Retrying…" : "Retry this file"}</button>
    </div>`;
}

function recomputeFor(row: RailRow): ReturnType<typeof recomputeTotals> | null {
  const t = row.totals;
  if (row.status !== "valid" || !t) return null;
  const sub = parseAmount(t.subTotal);
  if (sub === null) return null;
  const cgst = parseAmount(t.cgst);
  const taxable = parseAmount(t.taxableValue);
  if (cgst === null || taxable === null || taxable === 0) return null;
  const deductionsTotal = t.deductions.reduce((sum, d) => {
    const paisa = parseAmount(d.amount);
    return paisa === null ? sum : sum + paisa;
  }, 0);
  return recomputeTotals(sub, cgst / taxable, deductionsTotal);
}

function logTotalsFor(row: RailRow): LogTotals | null {
  const t = row.totals;
  const n = recomputeFor(row);
  if (!t || !n) return null;
  return {
    taxableOld: t.taxableValue,
    taxableNew: formatAmount(n.taxable),
    totalOld: t.grandTotalAfterRoundOff,
    totalNew: formatAmount(n.grandTotalAfterRoundOff),
  };
}

function facsimileHtml(row: RailRow): string {
  const t = row.totals;
  if (row.status !== "valid" || !t) return "";
  const n = recomputeFor(row);
  if (!n) return "";
  const newTaxable = formatAmount(n.taxable);
  const grand = formatAmount(n.grandTotal);
  const oldWords = t.words ?? "";
  const newWords = rupeesInWords(n.grandTotalAfterRoundOff);
  const changed = (old: string, nw: string) =>
    `<s class="old">${escapeHtml(old)}</s> <mark class="new">${escapeHtml(nw)}</mark>`;
  const facRow = (label: string, value: string, cls = "") =>
    `<div class="fac-row ${cls}"><span class="fac-label">${label}</span><span class="fac-value">${value}</span></div>`;
  return `
    <div class="facsimile">
      <div class="facsimile-title">Final Invoice Totals</div>
      ${facRow("Sub Total", escapeHtml(t.subTotal))}
      ${facRow("Discount", `<s class="old">${escapeHtml(t.discount)}</s> <span class="removed-note">✕ removed</span>`, "removed-row")}
      ${facRow("Taxable Value", changed(t.taxableValue, newTaxable))}
      ${facRow(`CGST on ${escapeHtml(newTaxable)}`, changed(t.cgst, formatAmount(n.cgst)))}
      ${facRow(`SGST on ${escapeHtml(newTaxable)}`, changed(t.sgst, formatAmount(n.sgst)))}
      ${facRow("Ex Showroom Price", changed(t.exShowroomPrice, formatAmount(n.exShowroom)))}
      ${t.deductions
        .map((d) => facRow(escapeHtml(d.label), escapeHtml(d.amount)))
        .join("\n      ")}
      ${facRow("Net Amount", changed(t.netAmount, formatAmount(n.net)))}
      ${facRow("Grand Total", changed(t.grandTotal, grand))}
      ${facRow("Round Off", changed(t.roundOff, formatAmount(n.roundOff)))}
      ${facRow("Grand Total (after Round Off)", changed(t.grandTotalAfterRoundOff, formatAmount(n.grandTotalAfterRoundOff)), "grand-total-row")}
      ${facRow("Amount in words", changed(oldWords, newWords), "words")}
    </div>`;
}

function exportNoteHtml(row: RailRow): string {
  const e = row.export;
  if (!e) return "";
  if (e.status === "saved") {
    return `<div class="saved-note" role="status">Saved ✓ to ${escapeHtml(e.path)}</div>`;
  }
  if (e.status === "refused" || e.status === "error") {
    return `<div class="refusal-reason" role="alert">${escapeHtml(e.reason)}</div>`;
  }
  return "";
}

function detailCell(label: string, value: string | null): string {
  return `
    <div class="detail-cell">
      <dt>${label}</dt>
      <dd${value === null ? ' class="unreadable"' : ""}>${value === null ? "~unreadable~" : escapeHtml(value)}</dd>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function pickAndIngest(): Promise<void> {
  const files = await window.app.pickFiles();
  await ingestFiles(files);
}

async function ingestFiles(files: { fileName: string; data: ArrayBuffer }[]): Promise<void> {
  if (files.length === 0) return;
  ingest = { total: files.length, done: 0, pending: files.map((f) => f.fileName) };
  render();
  for (const file of files) {
    try {
      const parsed = await window.app.parse(file);
      rows.push({ ...parsed, id: nextId++, data: file.data });
    } catch (err) {
      rows.push({
        id: nextId++,
        fileName: file.fileName,
        status: "error",
        refusalReason: null,
        errorReason: err instanceof Error ? err.message : String(err),
        details: emptyDetails(),
        totals: null,
        data: file.data,
      });
    }
    ingest.done++;
    ingest.pending.shift();
    render();
  }
  ingest = null;
  if (selectedId === null && rows.length > 0) selectedId = rows[0]!.id;
  render();
}

// --- Drag & drop -----------------------------------------------------------

let dragDepth = 0;

function showOverlay(show: boolean): void {
  const overlay = document.getElementById("drag-overlay");
  if (overlay) overlay.classList.toggle("visible", show);
}

window.addEventListener("dragenter", (e) => {
  if (![...(e.dataTransfer?.types ?? [])].includes("Files")) return;
  e.preventDefault();
  dragDepth++;
  showOverlay(true);
});

window.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
});

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) showOverlay(false);
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  showOverlay(false);
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
  if (files.length === 0) return;
  void (async () => {
    const picked = await Promise.all(
      files.map(async (f) => ({ fileName: f.name, data: await f.arrayBuffer() })),
    );
    await ingestFiles(picked);
  })();
});

// --- Menu ------------------------------------------------------------------

window.app.onMenu("menu:upload-invoice", () => void pickAndIngest());
window.app.onMenu("menu:export-batch", () => void exportBatch());
window.app.onMenu("menu:export-zip", () => void exportZip());
window.app.onMenu("menu:choose-folder", () => void pickFolder());
window.app.onMenu("menu:user-guide", () => openModal("guide"));
window.app.onMenu("menu:open-log", () => void openLogModal());
window.app.onMenu("menu:report-bug", () => void window.app.openExternal(APP_LINKS.bugTemplate));
window.app.onMenu("menu:check-updates", () => void checkForUpdates());
window.app.onMenu("menu:about", () => openModal("about"));

// --- Modals ------------------------------------------------------------------

function openModal(kind: ModalKind): void {
  modal = kind;
  renderModal();
}

function closeModal(): void {
  modal = null;
  renderModal();
}

async function openLogModal(): Promise<void> {
  modal = "log";
  logModal = { lines: null, savedTo: null };
  renderModal();
  logModal.lines = await window.app.getSessionLog();
  renderModal();
}

async function checkForUpdates(): Promise<void> {
  if (modal !== "about") openModal("about");
  const result = await window.app.checkUpdates();
  const el = document.getElementById("update-status");
  if (el) {
    el.textContent = result.text;
    el.classList.toggle("error", result.kind === "error");
  }
}

function logLineHtml(line: LogLine): string {
  const cls =
    line.kind === "ERROR" ? "log-error" : line.kind === "REFUSED" || line.kind === "FAILED" ? "log-bad" : "log-ok";
  return `<div class="log-line ${cls}"><span class="log-time">${escapeHtml(line.time)}</span> ${escapeHtml(line.text)}</div>`;
}

function logBodyHtml(): string {
  const monthFileName = monthFile ?? `rto-invoice-prep-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}.log`;
  const body =
    logModal.lines === null
      ? `<div class="logempty"><p>Loading…</p></div>`
      : logModal.lines.length === 0
        ? `<div class="logempty">
             <p><b>Nothing logged yet…</b> Activity appears here as files are read, prepared, refused, or written.</p>
             <p>Across sessions, entries append to a monthly file — <span class="log-month-file">${escapeHtml(monthFileName)}</span> — which is never rotated away or deleted; you manage it by hand via Open Folder.</p>
           </div>`
        : `<pre class="log-lines">${logModal.lines.map(logLineHtml).join("")}</pre>`;
  return `
    <header class="modal-head">
      <h2 id="modal-title">Log — this session</h2>
      <div class="modal-actions">
        <button class="modal-icon-btn" id="log-open-folder" type="button" title="Open the log folder (%APPDATA%\\rto-invoice-prep\\logs) — ${escapeHtml(monthFileName)}" aria-label="Open log folder">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h2.6c.4 0 .78.16 1.06.44l1.06 1.06c.1.1.23.15.35.15H13A1.5 1.5 0 0 1 14.5 4.5v8A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5V3z"/></svg>
        </button>
        <button class="modal-icon-btn" id="log-download" type="button" title="Save a copy of this session's log" aria-label="Save a copy of the log">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5a.6.6 0 0 1 .6.6v7.44l2.72-2.72a.6.6 0 1 1 .85.85l-3.75 3.75a.6.6 0 0 1-.85 0L3.82 7.67a.6.6 0 1 1 .85-.85l2.72 2.72V2.1A.6.6 0 0 1 8 1.5zM2.5 13.4a.6.6 0 0 1 .6-.6h9.8a.6.6 0 1 1 0 1.2H3.1a.6.6 0 0 1-.6-.6z"/></svg>
        </button>
        <button class="modal-close" type="button" data-modal-close aria-label="Close">✕</button>
      </div>
    </header>
    <div class="modal-body">
      ${body}
      ${logModal.savedTo ? `<div class="log-saved-note" role="status">Copy saved to ${escapeHtml(logModal.savedTo)}</div>` : ""}
    </div>`;
}

function guideBodyHtml(): string {
  return `
    <header class="modal-head">
      <h2 id="modal-title">User guide</h2>
      <div class="modal-actions">
        <button class="modal-link-btn" type="button" data-open-link="${APP_LINKS.docs}" title="Opens the full documentation on the project website">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 1.5A2.5 2.5 0 0 0 1.5 4v8A2.5 2.5 0 0 0 4 14.5h8a.75.75 0 0 0 0-1.5H4a1 1 0 0 1 0-2h8.25c.41 0 .75-.34.75-.75V2.25A.75.75 0 0 0 12.25 1.5H4z"/></svg>
          View full documentation
        </button>
        <button class="modal-close" type="button" data-modal-close aria-label="Close">✕</button>
      </div>
    </header>
    <div class="modal-body">
      <p><b>What this tool does.</b> It prepares dealership invoices for RTO registration: it removes the discount row from an OEM tax invoice and recalculates every downstream figure at the full, undiscounted price.</p>
      <p><b>How to use it.</b> Drop invoice PDFs onto the window (or use File → Upload Invoice), check each file's recalculated numbers on its preview card, then Export. Files that do not match the expected invoice template are refused with the reason named — they are never exported.</p>
      <p><b>Where files go.</b> Prepared PDFs are written to the output directory shown in the toolbar. Originals are never overwritten, and every batch is recorded in the log.</p>
      <p><b>Installing and updating.</b> The installer is not code-signed, so Windows SmartScreen may show "Windows protected your PC" — choose <b>More info → Run anyway</b>; this is asked only once. If Windows 11 <b>Smart App Control</b> is turned on, it blocks unsigned apps with no override — you would need to turn it off (Settings → Privacy &amp; security → Windows Security) to install this app. Updates download in the background and install automatically when you quit the app.</p>
    </div>`;
}

function aboutBodyHtml(): string {
  const v = versions;
  const runtime = v
    ? `Runs on Electron ${v.electron} · Chromium ${v.chrome} · Node ${v.node}`
    : `Runs on Electron · Chromium · Node`;
  return `
    <button class="modal-close floating" type="button" data-modal-close aria-label="Close">✕</button>
    <div class="modal-body">
      <div class="about-head">
        <span class="about-icon" aria-hidden="true">R</span>
        <span>
          <div class="about-name">RTO Invoice Prep</div>
          <div class="about-sub"><span class="ver">v${escapeHtml(v?.app ?? "0.1")}</span><span class="dot">·</span>
          <button class="linklike small" type="button" id="check-updates">Check for updates</button></div>
          <div class="tagline">Prepare dealership invoices for RTO registration.</div>
        </span>
      </div>
      <p>Made for a single dealership desk. Stateless — nothing is stored between runs, originals are never overwritten, and every batch is recorded in the log.</p>
      <div class="runtime-line">${runtime}</div>
      <div class="update-status" id="update-status" role="status"></div>
      <div class="about-links">
        <button class="linklike" type="button" data-open-link="${APP_LINKS.website}">Website</button><span class="dot">·</span>
        <button class="linklike" type="button" data-open-link="${APP_LINKS.repo}">Source</button><span class="dot">·</span>
        <button class="linklike" type="button" data-open-link="${APP_LINKS.bugTemplate}">Report a bug</button><span class="dot">·</span>
        <button class="linklike" type="button" data-open-link="${APP_LINKS.featureTemplate}">Feature request</button>
      </div>
    </div>`;
}

function renderModal(): void {
  if (modal === null) {
    modalRoot.innerHTML = "";
    return;
  }
  const body = modal === "log" ? logBodyHtml() : modal === "guide" ? guideBodyHtml() : aboutBodyHtml();
  const plain = modal === "about";
  const labelledBy = plain ? "" : ` aria-labelledby="modal-title"`;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-modal-close></div>
    <div class="modal${plain ? " plain" : ""}" role="dialog" aria-modal="true"${labelledBy}>
      ${body}
    </div>`;

  for (const btn of modalRoot.querySelectorAll<HTMLButtonElement>("[data-modal-close]")) {
    btn.addEventListener("click", closeModal);
  }
  for (const btn of modalRoot.querySelectorAll<HTMLButtonElement>("[data-open-link]")) {
    btn.addEventListener("click", () => void window.app.openExternal(btn.dataset.openLink!));
  }
  document.getElementById("log-open-folder")?.addEventListener("click", () => void window.app.openLogFolder());
  document.getElementById("log-download")?.addEventListener("click", () => void downloadLogCopy());
  document.getElementById("check-updates")?.addEventListener("click", () => void checkForUpdates());
}

async function downloadLogCopy(): Promise<void> {
  const saved = await window.app.downloadLog();
  if (saved) {
    logModal.savedTo = saved;
    renderModal();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (modal !== null) closeModal();
});

render();
