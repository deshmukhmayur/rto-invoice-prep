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
  status: "valid" | "refused";
  refusalReason: string | null;
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
  } | null;
};

export type PickedFile = { fileName: string; data: ArrayBuffer };

export const INGEST_CHANNELS = [
  "ingest:parse",
  "ingest:pick-files",
] as const;

export type IngestChannel = (typeof INGEST_CHANNELS)[number];
