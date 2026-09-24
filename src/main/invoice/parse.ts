import type { InvoiceDetails, ParsedRow } from "../../shared/ingest";
import { checkContentStreamPattern, checkFonts, extractRuns, loadDocument, pageContentStream, pageCount, type TextRun } from "./pdf-ops";

const TOTALS_LABELS = [
  "Sub Total",
  "Discount",
  "Taxable Value",
  "CGST",
  "SGST",
  "Ex Showroom Price",
  "Net Amount",
  "Grand Total",
  "Round Off",
  "Grand Total (after Round Off)",
] as const;

/** Right edge of the totals amount column, from the sample (spec §3). */
export const RIGHT_EDGE = 586.3;

type Line = { y: number; runs: TextRun[] };

function groupLines(runs: TextRun[]): Line[] {
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const run of sorted) {
    const line = lines.find((l) => Math.abs(l.y - run.y) <= 1.5);
    if (line) line.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  for (const line of lines) line.runs.sort((a, b) => a.x - b.x);
  return lines;
}

function labelText(line: Line): string {
  const labelRuns = line.runs.filter((r) => r.x < 500);
  return joinRuns(labelRuns).trim();
}

function joinRuns(runs: TextRun[]): string {
  let out = "";
  let prevEnd: { x: number; text: string } | null = null;
  for (const r of runs) {
    if (prevEnd) {
      const gap = r.x - (prevEnd.x + approxWidth(prevEnd.text));
      if (gap > 1.5) out += " ";
    }
    out += r.text;
    prevEnd = { x: r.x, text: r.text };
  }
  return out;
}

/** Rough Helvetica advance width (0.5 em average) — only used for run-gap joining. */
function approxWidth(text: string): number {
  return text.length * 4;
}

function valueText(line: Line): string | null {
  const valueRuns = line.runs.filter((r) => r.x >= 500);
  if (valueRuns.length === 0) return null;
  return joinRuns(valueRuns).trim();
}

/** Parse an Indian-grouped amount `55,872.88` into paisa. */
export function parseAmount(s: string): number | null {
  const m = s.trim().match(/^-?\d{1,3}(?:,\d{2,3})*\.\d{2}$|^-?\d+\.\d{2}$/);
  if (!m) return null;
  return Math.round(Number(s.replace(/,/g, "")) * 100);
}

export function formatAmount(paisa: number): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100);
  const group = rupees.toLocaleString("en-IN");
  return `${sign}${group}.${String(abs % 100).padStart(2, "0")}`;
}

export type TotalsRow = { label: string; labelFull: string; value: string | null; y: number };

/** Find the totals-block rows by label text, in document (top→bottom) order. */
export function findTotalsRows(lines: Line[]): { rows: TotalsRow[]; extraLines: Line[] } {
  const recognized: TotalsRow[] = [];
  const recognizedLines = new Set<Line>();
  for (const line of lines) {
    const label = normalizeLabel(labelText(line));
    const match = matchTotalsLabel(label);
    if (match) {
      recognized.push({ label: match, labelFull: label, value: valueText(line), y: line.y });
      recognizedLines.add(line);
    }
  }
  if (recognized.length === 0) return { rows: recognized, extraLines: [] };

  // Anything with label-column text strictly between the first and last
  // recognized row that isn't itself a totals label is an inserted extra row.
  const blockTop = Math.max(...recognized.map((r) => r.y));
  const blockBottom = Math.min(...recognized.map((r) => r.y));
  const extra = lines.filter(
    (line) =>
      !recognizedLines.has(line) &&
      line.y < blockTop &&
      line.y > blockBottom &&
      line.runs.some((r) => r.x < 500 && r.text.trim()),
  );
  return { rows: recognized, extraLines: extra };
}

function normalizeLabel(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function matchTotalsLabel(label: string): string | null {
  if (label === "Sub Total") return "Sub Total";
  if (label === "Discount") return "Discount";
  if (label === "Taxable Value") return "Taxable Value";
  if (/^CGST on [\d,.]+$/.test(label)) return "CGST";
  if (/^SGST on [\d,.]+$/.test(label)) return "SGST";
  if (label === "Ex Showroom Price") return "Ex Showroom Price";
  if (label === "Net Amount") return "Net Amount";
  if (label === "Grand Total") return "Grand Total";
  if (label === "Round Off") return "Round Off";
  if (label === "Grand Total (after Round Off)") return "Grand Total (after Round Off)";
  return null;
}

function refusal(fileName: string, reason: string, details: InvoiceDetails): ParsedRow {
  return { fileName, status: "refused", refusalReason: reason, details, totals: null };
}

const UNREADABLE = "~unreadable~";

export async function parseInvoice(fileName: string, bytes: Uint8Array): Promise<ParsedRow> {
  let doc;
  try {
    doc = await loadDocument(bytes);
  } catch {
    return refusal(fileName, "Not a readable PDF document", emptyDetails());
  }

  if (pageCount(doc) !== 2) {
    return refusal(fileName, `Template validation failed: expected 2 pages, found ${pageCount(doc)}`, emptyDetails());
  }

  const fontDrift = checkFonts(doc, 0) ?? checkFonts(doc, 1);
  if (fontDrift) return refusal(fileName, `Template validation failed: ${fontDrift}`, emptyDetails());

  const stream = pageContentStream(doc, 0);
  const drift = checkContentStreamPattern(stream);
  if (drift) return refusal(fileName, `Template validation failed: ${drift}`, emptyDetails());

  const runs = extractRuns(stream);
  const lines = groupLines(runs);
  const { rows, extraLines } = findTotalsRows(lines);

  // Details extraction (shown even on refused rows).
  const details = extractDetails(lines);

  if (rows.length === 0) {
    return refusal(fileName, "No Discount row found — totals block not recognised", details);
  }
  const discountRows = rows.filter((r) => r.label === "Discount");
  if (discountRows.length === 0) {
    return refusal(fileName, "No Discount row found", details);
  }
  if (discountRows.length > 1) {
    return refusal(fileName, `Multiple Discount rows found (${discountRows.length})`, details);
  }
  if (extraLines.length > 0) {
    const observed = extraLines.map((l) => `"${labelText(l)}"`).join(", ");
    return refusal(fileName, `Unexpected extra row(s) in the totals block: ${observed}`, details);
  }

  // Row set must match exactly; a missing expected row is named.
  const foundLabels = new Set(rows.map((r) => r.label));
  const missingLabels = TOTALS_LABELS.filter((l) => !foundLabels.has(l));
  if (missingLabels.length > 0) {
    const found = rows.map((r) => r.label).join(" → ") || "(none)";
    if (missingLabels.length === TOTALS_LABELS.length) {
      return refusal(fileName, "No Discount row found — totals block not recognised", details);
    }
    return refusal(
      fileName,
      `Template validation failed: ${missingLabels[0]} row not found (totals block: ${found})`,
      details,
    );
  }
  for (let i = 0; i < TOTALS_LABELS.length; i++) {
    const row = rows[i]!;
    const expected = TOTALS_LABELS[i]!;
    if (row.label !== expected) {
      return refusal(fileName, `Template validation failed: totals row ${i + 1} is "${row.labelFull}", expected "${expected}"`, details);
    }
  }

  // Labels at sane coordinates: labels left column, values at the amount column, rows descending.
  for (const row of rows) {
    const line = lines.find((l) => l.y === row.y);
    const labelX = line ? Math.min(...line.runs.filter((r) => r.x < 500).map((r) => r.x)) : 0;
    if (labelX < 10 || labelX > 120) {
      return refusal(fileName, `Template validation failed: "${row.labelFull}" label at unexpected x=${labelX.toFixed(1)}`, details);
    }
  }
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const row = rows[i]!;
    if (row.y >= prev.y) {
      return refusal(fileName, `Template validation failed: totals rows out of vertical order at "${row.labelFull}"`, details);
    }
  }

  const byLabel = new Map(rows.map((r) => [r.label, r]));
  const missing = TOTALS_LABELS.filter((l) => {
    const v = byLabel.get(l)?.value;
    return v === null || v === undefined || v.trim() === "";
  });
  if (missing.length > 0) {
    return refusal(fileName, `Template validation failed: ${missing[0]} amount not found`, details);
  }

  type TotalsLabel = (typeof TOTALS_LABELS)[number];
  const amounts = new Map<TotalsLabel, number>();
  for (const label of TOTALS_LABELS) {
    const raw = byLabel.get(label)!.value!;
    const paisa = parseAmount(raw);
    if (paisa === null) {
      return refusal(fileName, `${label} amount not found (value "${raw.trim()}" is not a valid amount)`, details);
    }
    amounts.set(label, paisa);
  }

  const subTotal = amounts.get("Sub Total")!;
  const discount = amounts.get("Discount")!;
  const taxable = amounts.get("Taxable Value")!;

  if (discount === 0) {
    return refusal(fileName, "Discount is 0.00 — nothing to remove", details);
  }

  const expectedTaxable = subTotal - discount;
  if (expectedTaxable !== taxable) {
    return refusal(
      fileName,
      `Amounts do not add up: ${formatAmount(subTotal)} − ${formatAmount(discount)} = ${formatAmount(expectedTaxable)}, but Taxable Value is ${formatAmount(taxable)}`,
      details,
    );
  }

  return {
    fileName,
    status: "valid",
    refusalReason: null,
    details,
    totals: {
      subTotal: byLabel.get("Sub Total")!.value!.trim(),
      discount: byLabel.get("Discount")!.value!.trim(),
      taxableValue: byLabel.get("Taxable Value")!.value!.trim(),
      cgst: byLabel.get("CGST")!.value!.trim(),
      sgst: byLabel.get("SGST")!.value!.trim(),
      exShowroomPrice: byLabel.get("Ex Showroom Price")!.value!.trim(),
      netAmount: byLabel.get("Net Amount")!.value!.trim(),
      grandTotal: byLabel.get("Grand Total")!.value!.trim(),
      roundOff: byLabel.get("Round Off")!.value!.trim(),
      grandTotalAfterRoundOff: byLabel.get("Grand Total (after Round Off)")!.value!.trim(),
    },
  };
}

function emptyDetails(): InvoiceDetails {
  return { invoiceNo: null, customer: null, invoiceDate: null, model: null, chassisNo: null, engineNo: null };
}

/** Pull the identity fields (spec §6 details grid); missing fields render `~unreadable~` in the UI. */
function extractDetails(lines: Line[]): InvoiceDetails {
  const findLabelLine = (runText: string): Line | undefined =>
    lines.find((l) => l.runs.some((r) => normalizeLabel(r.text) === runText));

  const valueRightOf = (line: Line, label: string): string | null => {
    const labelRun = line.runs.find((r) => normalizeLabel(r.text) === label);
    if (!labelRun) return null;
    const labelEnd = labelRun.x + approxWidth(labelRun.text);
    const valueRuns = line.runs.filter((r) => r.x > labelEnd + 1 && r.x < 500 && r.text.trim());
    if (valueRuns.length === 0) return null;
    return joinRuns(valueRuns).trim() || null;
  };

  const tableValueUnder = (headerText: string): string | null => {
    let headerRun: TextRun | undefined;
    for (const line of lines) {
      headerRun = line.runs.find((r) => normalizeLabel(r.text) === headerText);
      if (headerRun) break;
    }
    if (!headerRun) return null;
    // Value sits ~16pt below the header row, within the header's column span.
    const candidates = lines.filter((l) => l.y < headerRun.y - 2 && l.y > headerRun.y - 30);
    for (const line of candidates) {
      const run = line.runs.find(
        (r) => r.x >= headerRun.x - 12 && r.x < headerRun.x + 60 && r.text.trim(),
      );
      if (run) return run.text.trim();
    }
    return null;
  };

  const invoiceNoLine = findLabelLine("Invoice #");
  const dateLine = findLabelLine("Date");
  const customerLine = findLabelLine("Name of the Customer");

  return {
    invoiceNo: invoiceNoLine ? valueRightOf(invoiceNoLine, "Invoice #") : null,
    invoiceDate: dateLine ? valueRightOf(dateLine, "Date") : null,
    customer: customerLine ? valueRightOf(customerLine, "Name of the Customer") : null,
    model: tableValueUnder("Model"),
    engineNo: tableValueUnder("Engine#"),
    chassisNo: tableValueUnder("Chassis"),
  };
}

export { UNREADABLE };
