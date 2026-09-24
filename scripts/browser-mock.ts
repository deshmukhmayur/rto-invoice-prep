// Dev-only browser mock of the preload API (see scripts/dev-server.ts).
// Never loaded by the Electron app — index.html only references renderer.js.
import type { ExportRequest, ExportResult, ParsedRow, PickedFile } from "../src/shared/ingest";
import type { MenuChannel } from "../src/channels";
import { prepareInvoice } from "../src/main/invoice/transform";
import { parseInvoice } from "../src/main/invoice/parse";

declare global {
  interface Window {
    app: {
      onMenu: (channel: MenuChannel, handler: () => void) => void;
      pickFiles: () => Promise<PickedFile[]>;
      parse: (file: PickedFile) => Promise<ParsedRow>;
      exportOne: (req: ExportRequest) => Promise<ExportResult>;
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
      ? { invoiceNo: null, customer: "AARAV SHARMA", invoiceDate: null, model: "HF DELUXE", chassisNo: null, engineNo: null }
      : {
          invoiceNo: "10000BI26S0001",
          customer: "AARAV SHARMA",
          invoiceDate: "19/09/2026 16:37:30",
          model: "HF DELUXE",
          chassisNo: "MBLHAW502T5H00001",
          engineNo: "HA11F4T5H00001",
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
          words: "Rupees Sixty Three Thousand Eight Hundred Thirty Only",
        },
  };
}

window.app = {
  onMenu: (channel) => console.log(`[browser dev mock] ${channel}`),
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
};
