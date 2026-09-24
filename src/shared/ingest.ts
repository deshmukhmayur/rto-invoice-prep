export type InvoiceDetails = {
  invoiceNo: string | null;
  customer: string | null;
  invoiceDate: string | null;
  model: string | null;
  chassisNo: string | null;
  engineNo: string | null;
};

export type ParsedRow = {
  fileName: string;
  status: "valid" | "refused" | "error";
  refusalReason: string | null;
  /** Set only when status is "error" — an unexpected parser crash, not a refusal. */
  errorReason: string | null;
  details: InvoiceDetails;
  totals: {
    subTotal: string;
    discount: string;
    taxableValue: string;
    cgst: string;
    sgst: string;
    exShowroomPrice: string;
    netAmount: string;
    grandTotal: string;
    roundOff: string;
    grandTotalAfterRoundOff: string;
    words: string | null;
  } | null;
};

export type PickedFile = { fileName: string; data: ArrayBuffer };

export function emptyDetails(): InvoiceDetails {
  return { invoiceNo: null, customer: null, invoiceDate: null, model: null, chassisNo: null, engineNo: null };
}

export const INGEST_CHANNELS = [
  "ingest:parse",
  "ingest:pick-files",
] as const;

export type IngestChannel = (typeof INGEST_CHANNELS)[number];

export type ExportRequest = { fileName: string; data: ArrayBuffer };

export type ExportResult =
  | { status: "saved"; path: string }
  | { status: "canceled" }
  | { status: "refused"; reason: string }
  | { status: "error"; reason: string };

export type BatchFileRequest = { fileName: string; data: ArrayBuffer };

export type BatchFileResult =
  | { fileName: string; status: "saved"; path: string }
  | { fileName: string; status: "error"; reason: string };

export type FolderCheck = { ok: boolean; reason: string | null };

export type BatchExportRequest = { dir: string; files: BatchFileRequest[] };
export type ZipExportRequest = { dir: string; zipName: string; files: BatchFileRequest[] };

export const EXPORT_CHANNELS = [
  "export:default-dir",
  "export:pick-dir",
  "export:check-dir",
  "export:save-batch",
  "export:save-zip",
] as const;

export const LOG_CHANNELS = ["log:open-log", "log:report-bug"] as const;
