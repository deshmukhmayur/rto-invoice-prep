import type { ParsedRow } from "../shared/ingest";
import "./app-api";

type RailRow = ParsedRow & { id: number };

let nextId = 1;
let rows: RailRow[] = [];
let ingest: { total: number; done: number; pending: string[] } | null = null;

const main = document.querySelector("main")!;

function render(): void {
  if (rows.length === 0 && !ingest) {
    main.innerHTML = emptyStateHtml();
    return;
  }
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
      <section class="cards" id="cards"></section>
    </div>`;

  document.getElementById("upload-block")?.addEventListener("click", pickAndIngest);
  const fill = main.querySelector<HTMLElement>(".ingest-bar-fill[data-fill]");
  if (fill && ingest) fill.style.width = `${Math.round((ingest.done / ingest.total) * 100)}%`;
  for (const btn of main.querySelectorAll<HTMLButtonElement>("[data-remove]")) {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.remove);
      rows = rows.filter((r) => r.id !== id);
      render();
    });
  }
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
  const refused = row.status === "refused" ? `
    <div class="refusal-reason" role="alert">${escapeHtml(row.refusalReason ?? "Refused")}</div>` : "";
  return `
    <div class="rail-row" data-id="${row.id}">
      <div class="row-head">
        <span class="dot ${dot}" title="${row.status}"></span>
        <span class="row-name" title="${escapeHtml(row.fileName)}">${escapeHtml(row.fileName)}</span>
        <button class="remove" type="button" data-remove="${row.id}" title="Remove ${escapeHtml(row.fileName)}" aria-label="Remove ${escapeHtml(row.fileName)}">✕</button>
      </div>
      <dl class="details-grid">
        ${detailCell("Invoice no.", row.details.invoiceNo)}
        ${detailCell("Customer", row.details.customer)}
        ${detailCell("Invoice date", row.details.invoiceDate)}
        ${detailCell("Model", row.details.model)}
        ${detailCell("Chassis no.", row.details.chassisNo)}
        ${detailCell("Engine no.", row.details.engineNo)}
      </dl>
      ${refused}
    </div>`;
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
      rows.push({ ...parsed, id: nextId++ });
    } catch {
      rows.push({
        id: nextId++,
        fileName: file.fileName,
        status: "refused",
        refusalReason: "The file could not be read (unexpected error — see log).",
        details: { invoiceNo: null, customer: null, invoiceDate: null, model: null, chassisNo: null, engineNo: null },
        totals: null,
      });
    }
    ingest.done++;
    ingest.pending.shift();
    render();
  }
  ingest = null;
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
