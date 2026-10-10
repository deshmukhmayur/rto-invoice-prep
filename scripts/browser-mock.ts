// Dev-only browser mock of the preload API (see scripts/dev-server.ts).
// Never loaded by the Electron app — index.html only references renderer.js.
import type {
  BatchExportRequest,
  BatchFileResult,
  ExportRequest,
  ExportResult,
  FolderCheck,
  ParsedRow,
  PickedFile,
  ZipExportRequest,
} from "../src/shared/ingest";
import type { MenuChannel } from "../src/channels";
import { prepareInvoice } from "../src/main/invoice/transform";
import { parseInvoice } from "../src/main/invoice/parse";
import { createZip } from "../src/shared/zip";
import { uniqueName } from "../src/shared/unique";

declare global {
  interface Window {
    app: {
      onMenu: (channel: MenuChannel, handler: () => void) => void;
      pickFiles: () => Promise<PickedFile[]>;
      parse: (file: PickedFile) => Promise<ParsedRow>;
      exportOne: (req: ExportRequest) => Promise<ExportResult>;
      defaultFolder: () => Promise<string>;
      pickFolder: () => Promise<string | null>;
      checkFolder: (dir: string) => Promise<FolderCheck>;
      exportBatch: (req: BatchExportRequest) => Promise<BatchFileResult[]>;
      exportZip: (req: ZipExportRequest) => Promise<ExportResult>;
      openLog: () => Promise<void>;
      reportBug: () => Promise<void>;
    };
  }
}

document.title = "RTO Invoice Prep v0.1 (browser dev)";

function fakeRow(fileName: string): ParsedRow {
  const refused = fileName.toLowerCase().includes("bad");
  return {
    fileName,
    status: refused ? "refused" : "valid",
    refusalReason: refused
      ? "Discount is 0.00 — nothing to remove"
      : null,
    details: refused
      ? { invoiceNo: null, customer: "AARAV SHARMA", invoiceDate: null, model: "HF DELUXE", chassisNo: null, engineNo: null, engineLabel: null }
      : {
          invoiceNo: "10000BI26S0001",
          customer: "AARAV SHARMA",
          invoiceDate: "19/09/2026 16:37:30",
          model: "HF DELUXE",
          chassisNo: "MBLHAW502T5H00001",
          engineNo: "HA11F4T5H00001",
          engineLabel: "Engine#",
        },
    totals: refused
      ? null
      : {
          subTotal: "55,872.88",
          discount: "1,780.00",
          taxableValue: "54,092.88",
          cgst: "4,868.36",
          sgst: "4,868.36",
          exShowroomPrice: "63,829.60",
          netAmount: "63,829.60",
          grandTotal: "63,829.60",
          roundOff: "0.40",
          grandTotalAfterRoundOff: "63,830.00",
          deductions: [],
          words: "Rupees Sixty Three Thousand Eight Hundred Thirty Only",
        },
  };
}

window.app = {
  onMenu: (channel, handler) => {
    // Dev harness: dispatch a CustomEvent "mock-menu" with {detail: channel}
    // from the console to trigger menu actions.
    window.addEventListener("mock-menu", ((e: CustomEvent<string>) => {
      if (e.detail === channel) handler();
    }) as EventListener);
    console.log(`[browser dev mock] registered ${channel}`);
  },
  pickFiles: async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.multiple = true;
    return new Promise((resolve) => {
      input.addEventListener("change", async () => {
        const files = await Promise.all(
          [...input.files].map(async (f) => ({ fileName: f.name, data: await f.arrayBuffer() })),
        );
        resolve(files);
      });
      input.click();
    });
  },
  parse: async (file) => {
    // Simulate read latency so the ingest progress UI is visible in the browser.
    await new Promise((r) => setTimeout(r, 700));
    // Files named fake*.pdf get canned rows; everything else goes through the
    // real parser, so a prepared file re-uploaded here is refused like in the app.
    if (/^fake/i.test(file.fileName)) return fakeRow(file.fileName);
    // crash*.pdf simulates an unexpected parser crash (status "error" row).
    if (/crash/i.test(file.fileName)) throw new Error("Simulated parser crash (browser dev mock)");
    return parseInvoice(file.fileName, new Uint8Array(file.data));
  },
  exportOne: async (req) => {
    if (req.fileName.toLowerCase().includes("bad")) {
      return { status: "refused", reason: "Discount is 0.00 — nothing to remove" };
    }
    // Simulate a save dialog → download of the real prepared bytes, so a
    // prepared file re-uploaded in dev:browser behaves like in the app.
    let data = req.data;
    try {
      data = await prepareInvoice(req.data, { version: "0.1" });
    } catch (err) {
      console.error("[browser dev mock] prepareInvoice failed:", err);
      return { status: "error", reason: err instanceof Error ? err.message : "Preparation failed" };
    }
    const blob = new Blob([data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${req.fileName.replace(/\.pdf$/i, "")}-RTO.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return { status: "saved", path: `${a.download} (browser download)` };
  },
  defaultFolder: async () => "~/Downloads",
  pickFolder: async () => {
    const dir = window.prompt("Output folder (use a path containing 'unwritable' to demo a blocked export)", "~/Downloads");
    return dir?.trim() || null;
  },
  checkFolder: async (dir) =>
    /unwritable|denied/i.test(dir)
      ? { ok: false, reason: `cannot write to "${dir}" (EACCES: permission denied)` }
      : { ok: true, reason: null },
  exportBatch: async (req) => {
    const results: BatchFileResult[] = [];
    for (const file of req.files) {
      await new Promise((r) => setTimeout(r, 350));
      // fail*.pdf simulates a mid-batch write failure (retryable in the UI).
      if (/fail/i.test(file.fileName)) {
        const reason = `EACCES: permission denied, write '${req.dir}/${file.fileName.replace(/\.pdf$/i, "")}-RTO.pdf'`;
        console.error("[browser dev mock] simulated write failure for", file.fileName);
        results.push({ fileName: file.fileName, status: "error", reason });
      } else {
        results.push({
          fileName: file.fileName,
          status: "saved",
          path: `${req.dir}/${file.fileName.replace(/\.pdf$/i, "")}-RTO.pdf (simulated write)`,
        });
      }
    }
    return results;
  },
  exportZip: async (req) => {
    const zipName = window.prompt("Save zip as", req.zipName);
    if (!zipName?.trim()) return { status: "canceled" };
    await new Promise((r) => setTimeout(r, 600));
    const entries: { name: string; data: Uint8Array }[] = [];
    const used = new Set<string>();
    for (const file of req.files) {
      try {
        const data = await prepareInvoice(file.data, { version: "0.1" });
        entries.push({ name: uniqueName(`${file.fileName.replace(/\.pdf$/i, "")}-RTO.pdf`, used), data });
      } catch (err) {
        return {
          status: "error",
          reason: `${file.fileName}: ${err instanceof Error ? err.message : "Preparation failed"}`,
        };
      }
    }
    const blob = new Blob([createZip(entries)], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName.trim();
    a.click();
    URL.revokeObjectURL(url);
    return { status: "saved", path: `${req.dir}/${zipName.trim()} (browser download)` };
  },
  openLog: async () => console.log("[browser dev mock] open log (file lives in app-data in the app)"),
  openLogFolder: async () => console.log("[browser dev mock] open logs folder (file lives in app-data in the app)"),
  getSessionLog: async () => [    { kind: "OK", time: "2026-10-10T10:00:00.000Z", text: "OK invoice-1.pdf — extracted invoice MH-2026-001, chassis ABC123456" },
    { kind: "OK", time: "2026-10-10T10:01:00.000Z", text: "OK invoice-1.pdf\n  taxable 63,324.00 → 63,660.00\n  total   63,830.00 → 64,640.00\n  wrote /out/invoice-1-RTO.pdf" },
    { kind: "REFUSED", time: "2026-10-10T10:02:00.000Z", text: "REFUSED invoice-2.pdf: already prepared (contains RTO marker)" },
    { kind: "FAILED", time: "2026-10-10T10:03:00.000Z", text: "FAILED invoice-3.pdf: EACCES: permission denied, write /out/invoice-3-RTO.pdf" },
    { kind: "ERROR", time: "2026-10-10T10:04:00.000Z", text: "ERROR invoice-4.pdf: parser crash — unexpected end of stream" },
  ],
  logMonthFile: async () => {
    const d = new Date();
    return `rto-invoice-prep-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}.log`;
  },
  downloadLog: async () => {
    console.log("[browser dev mock] download log copy");
    return null;
  },
  reportBug: async () => console.log("[browser dev mock] report a bug"),
};
