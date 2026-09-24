import type { ExportResult, ParsedRow } from "../shared/ingest";
import { formatAmount, parseAmount, recomputeTotals, rupeesInWords } from "../shared/totals";
import "./app-api";

type RailRow = ParsedRow & { id: number; data: ArrayBuffer; export?: ExportResult };

let nextId = 1;
let rows: RailRow[] = [];
let selectedId: number | null = null;
let ingest: { total: number; done: number; pending: string[] } | null = null;

const main = document.querySelector("main")!;

function removeRow(id: number): void {
  const index = rows.findIndex((r) => r.id === id);
  rows = rows.filter((r) => r.id !== id);
  if (selectedId === id) {
    selectedId = rows.length === 0 ? null : rows[Math.min(index, rows.length - 1)]!.id;
  }
}

function render(): void {
  if (rows.length === 0 && !ingest) {
    main.innerHTML = emptyStateHtml();
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
        ${!ingest && rows.length > 0 && rows.every((r) => r.status === "refused")
          ? `<div class="refused-strip" role="alert">All ${rows.length} file${rows.length === 1 ? " was" : "s were"} refused or could not be read — nothing can be exported. Remove the files or upload different ones.</div>`
          : ""}
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
  const result = await window.app.exportOne({ fileName: row.fileName, data: row.data });
  row.export = result;
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
      <p>Drop PDFs anywhere in this window, use <b>File → Upload Invoice</b>,<br>or the Upload block in the left rail.</p>
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
  const dot = row.status === "valid" ? "pass" : "fail";
  const selected = row.id === selectedId;
  return `
    <div class="rail-row${selected ? " selected" : ""}" data-row="${row.id}" role="button" tabindex="0" aria-pressed="${selected}" aria-label="${escapeHtml(row.fileName)}">
      <div class="row-head">
        <span class="dot ${dot}" title="${row.status}"></span>
        <span class="row-name" title="${escapeHtml(row.fileName)}">${escapeHtml(row.fileName)}</span>
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
  return `
    <div class="card">
      <div class="card-head">
        <span class="card-name" title="${escapeHtml(row.fileName)}">${escapeHtml(row.fileName)}</span>
        ${download}
      </div>
      <dl class="details-grid">
        ${detailCell("Invoice no.", row.details.invoiceNo)}
        ${detailCell("Customer", row.details.customer)}
        ${detailCell("Invoice date", row.details.invoiceDate)}
        ${detailCell("Model", row.details.model)}
        ${detailCell("Chassis no.", row.details.chassisNo)}
        ${detailCell("Engine no.", row.details.engineNo)}
      </dl>
      ${facsimileHtml(row)}
      ${refused}
      ${exportNoteHtml(row)}
    </div>`;
}

function facsimileHtml(row: RailRow): string {
  const t = row.totals;
  if (row.status !== "valid" || !t) return "";
  const sub = parseAmount(t.subTotal);
  if (sub === null) return "";
  const n = recomputeTotals(sub);
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
      <div class="facsimile-title">Totals after preparation</div>
      ${facRow("Sub Total", escapeHtml(t.subTotal))}
      ${facRow("Discount", `<s class="old">${escapeHtml(t.discount)}</s> <span class="removed-note">✕ removed</span>`, "removed-row")}
      ${facRow("Taxable Value", changed(t.taxableValue, newTaxable))}
      ${facRow(`CGST on ${escapeHtml(newTaxable)}`, changed(t.cgst, formatAmount(n.cgst)))}
      ${facRow(`SGST on ${escapeHtml(newTaxable)}`, changed(t.sgst, formatAmount(n.sgst)))}
      ${facRow("Ex Showroom Price", changed(t.exShowroomPrice, grand))}
      ${facRow("Net Amount", changed(t.netAmount, grand))}
      ${facRow("Grand Total", changed(t.grandTotal, grand))}
      ${facRow("Round Off", changed(t.roundOff, formatAmount(n.roundOff)))}
      ${facRow("Grand Total (after Round Off)", changed(t.grandTotalAfterRoundOff, formatAmount(n.grandTotalAfterRoundOff)))}
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
    } catch {
      rows.push({
        id: nextId++,
        fileName: file.fileName,
        status: "refused",
        refusalReason: "The file could not be read (unexpected error — see log).",
        details: { invoiceNo: null, customer: null, invoiceDate: null, model: null, chassisNo: null, engineNo: null },
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
window.app.onMenu("menu:open-log", () => console.log("menu:open-log"));
window.app.onMenu("menu:report-bug", () => console.log("menu:report-bug"));
window.app.onMenu("menu:about", () => console.log("menu:about"));

render();
