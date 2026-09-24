// Dev-only browser mock of the preload API (see scripts/dev-server.ts).
// Never loaded by the Electron app — index.html only references renderer.js.
import type { ParsedRow, PickedFile } from "../src/shared/ingest";
import type { MenuChannel } from "../src/channels";

declare global {
  interface Window {
    app: {
      onMenu: (channel: MenuChannel, handler: () => void) => void;
      pickFiles: () => Promise<PickedFile[]>;
      parse: (file: PickedFile) => Promise<ParsedRow>;
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
    totals: null,
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
    return fakeRow(file.fileName);
  },
};
