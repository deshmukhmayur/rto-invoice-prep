import type { InvoiceDetails, ParsedRow } from "../../shared/ingest";
import { emptyDetails } from "../../shared/ingest";
import type { PDFDocument } from "pdf-lib";
import { parseAmount, formatAmount } from "../../shared/totals";
import { checkContentStreamPattern, checkFonts, extractRuns, loadDocument, pageContentStream, pageCount, type TextRun } from "./pdf-ops";

export { parseAmount, formatAmount };

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

export type Line = { y: number; runs: TextRun[] };

export function groupLines(runs: TextRun[]): Line[] {
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

export function labelText(line: Line): string {
  const labelRuns = line.runs.filter((r) => r.x < 500);
  return joinRuns(labelRuns).trim();
}

export function joinRuns(runs: TextRun[]): string {
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
export function approxWidth(text: string): number {
  return text.length * 4;
}

export function valueText(line: Line): string | null {
  const valueRuns = line.runs.filter((r) => r.x >= 500);
  if (valueRuns.length === 0) return null;
  return joinRuns(valueRuns).trim();
}

export type TotalsRow = { label: string; labelFull: string; value: string | null; y: number };

/** A post-tax deduction row (e.g. "PM E-DRIVE Subsidy") between Ex Showroom Price and Net Amount. */
export type DeductionRow = { label: string; labelFull: string; amount: number; y: number };

/** Find the totals-block rows by label text, in document (top→bottom) order. */
export function findTotalsRows(lines: Line[]): {
  rows: TotalsRow[];
  deductions: TotalsRow[];
  extraLines: Line[];
} {
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
  if (recognized.length === 0) return { rows: recognized, deductions: [], extraLines: [] };

  // Anything with label-column text strictly between the first and last
  // recognized row that isn't itself a totals label is an inserted extra row.
  // Rows in the Ex Showroom Price → Net Amount gap are post-tax deductions
  // (e.g. "PM E-DRIVE Subsidy"); rows anywhere else are disallowed extras.
  const blockTop = Math.max(...recognized.map((r) => r.y));
  const blockBottom = Math.min(...recognized.map((r) => r.y));
  const exShowroomY = recognized.find((r) => r.label === "Ex Showroom Price")?.y;
  const netY = recognized.find((r) => r.label === "Net Amount")?.y;
  const deductions: TotalsRow[] = [];
  const extraLines: Line[] = [];
  const extra = lines.filter(
    (line) =>
      !recognizedLines.has(line) &&
      line.y < blockTop &&
      line.y > blockBottom &&
      line.runs.some((r) => r.x < 500 && r.text.trim()),
  );
  for (const line of extra) {
    const inGap =
      exShowroomY !== undefined &&
      netY !== undefined &&
      line.y < exShowroomY &&
      line.y > netY;
    if (inGap) {
      deductions.push({
        label: normalizeLabel(labelText(line)),
        labelFull: normalizeLabel(labelText(line)),
        value: valueText(line),
        y: line.y,
      });
    } else {
      extraLines.push(line);
    }
  }
  deductions.sort((a, b) => b.y - a.y);
  return { rows: recognized, deductions, extraLines };
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
  return { fileName, status: "refused", refusalReason: reason, errorReason: null, details, totals: null };
}

export type TotalsLabel = (typeof TOTALS_LABELS)[number];

export type Analysis =
  | { ok: false; reason: string; details: InvoiceDetails }
  | {
      ok: true;
      details: InvoiceDetails;
      lines: Line[];
      rows: TotalsRow[];
      byLabel: Map<TotalsLabel, TotalsRow>;
      amounts: Map<TotalsLabel, number>;
      /** Post-tax deduction rows (Ex Showroom → Net gap), top→bottom. */
      deductions: DeductionRow[];
      /** Derived effective CGST rate (cgst ÷ taxable); SGST is validated equal. */
      taxRate: number;
      oldWords: string | null;
    };

/** Validate the loaded document against the template and extract everything the transformation needs. */
export function analyze(doc: PDFDocument, fileName: string): Analysis {
  const empty = emptyDetails();

  if (pageCount(doc) !== 2) {
    return { ok: false, reason: `Template validation failed: expected 2 pages, found ${pageCount(doc)}`, details: empty };
  }

  const fontDrift = checkFonts(doc, 0) ?? checkFonts(doc, 1);
  if (fontDrift) return { ok: false, reason: `Template validation failed: ${fontDrift}`, details: empty };

  const stream = pageContentStream(doc, 0);
  const drift = checkContentStreamPattern(stream);
  if (drift) return { ok: false, reason: `Template validation failed: ${drift}`, details: empty };

  const runs = extractRuns(stream);
  const lines = groupLines(runs);
  const { rows, deductions: deductionRows, extraLines } = findTotalsRows(lines);

  // Details extraction (shown even on refused rows).
  const details = extractDetails(lines);

  if (rows.length === 0) {
    return { ok: false, reason: "No Discount row found — totals block not recognised", details };
  }
  const discountRows = rows.filter((r) => r.label === "Discount");
  if (discountRows.length === 0) {
    return { ok: false, reason: "No Discount row found", details };
  }
  if (discountRows.length > 1) {
    return { ok: false, reason: `Multiple Discount rows found (${discountRows.length})`, details };
  }
  if (extraLines.length > 0) {
    const observed = extraLines.map((l) => `"${labelText(l)}"`).join(", ");
    return { ok: false, reason: `Unexpected extra row(s) in the totals block: ${observed}`, details };
  }

  // Row set must match exactly; a missing expected row is named.
  const foundLabels = new Set(rows.map((r) => r.label));
  const missingLabels = TOTALS_LABELS.filter((l) => !foundLabels.has(l));
  if (missingLabels.length > 0) {
    const found = rows.map((r) => r.label).join(" → ") || "(none)";
    if (missingLabels.length === TOTALS_LABELS.length) {
      return { ok: false, reason: "No Discount row found — totals block not recognised", details };
    }
    return {
      ok: false,
      reason: `Template validation failed: ${missingLabels[0]} row not found (totals block: ${found})`,
      details,
    };
  }
  for (let i = 0; i < TOTALS_LABELS.length; i++) {
    const row = rows[i]!;
    const expected = TOTALS_LABELS[i]!;
    if (row.label !== expected) {
      return {
        ok: false,
        reason: `Template validation failed: totals row ${i + 1} is "${row.labelFull}", expected "${expected}"`,
        details,
      };
    }
  }

  // Labels at sane coordinates: labels left column, values at the amount column, rows descending.
  for (const row of rows) {
    const line = lines.find((l) => l.y === row.y);
    const labelX = line ? Math.min(...line.runs.filter((r) => r.x < 500).map((r) => r.x)) : 0;
    if (labelX < 10 || labelX > 120) {
      return {
        ok: false,
        reason: `Template validation failed: "${row.labelFull}" label at unexpected x=${labelX.toFixed(1)}`,
        details,
      };
    }
  }
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const row = rows[i]!;
    if (row.y >= prev.y) {
      return {
        ok: false,
        reason: `Template validation failed: totals rows out of vertical order at "${row.labelFull}"`,
        details,
      };
    }
  }

  const byLabel = new Map(rows.map((r) => [r.label as TotalsLabel, r]));
  const missing = TOTALS_LABELS.filter((l) => {
    const v = byLabel.get(l)?.value;
    return v === null || v === undefined || v.trim() === "";
  });
  if (missing.length > 0) {
    return { ok: false, reason: `Template validation failed: ${missing[0]} amount not found`, details };
  }

  const amounts = new Map<TotalsLabel, number>();
  for (const label of TOTALS_LABELS) {
    const raw = byLabel.get(label)!.value!;
    const paisa = parseAmount(raw);
    if (paisa === null) {
      return {
        ok: false,
        reason: `${label} amount not found (value "${raw.trim()}" is not a valid amount)`,
        details,
      };
    }
    amounts.set(label, paisa);
  }

  const subTotal = amounts.get("Sub Total")!;
  const discount = amounts.get("Discount")!;
  const taxable = amounts.get("Taxable Value")!;
  const cgst = amounts.get("CGST")!;
  const sgst = amounts.get("SGST")!;
  const exShowroom = amounts.get("Ex Showroom Price")!;
  const net = amounts.get("Net Amount")!;

  if (discount === 0) {
    return { ok: false, reason: "Discount is 0.00 — nothing to remove", details };
  }

  const expectedTaxable = subTotal - discount;
  if (expectedTaxable !== taxable) {
    return {
      ok: false,
      reason: `Amounts do not add up: ${formatAmount(subTotal)} − ${formatAmount(discount)} = ${formatAmount(expectedTaxable)}, but Taxable Value is ${formatAmount(taxable)}`,
      details,
    };
  }

  if (cgst !== sgst) {
    return {
      ok: false,
      reason: `Amounts do not add up: CGST (${formatAmount(cgst)}) and SGST (${formatAmount(sgst)}) differ`,
      details,
    };
  }
  if (taxable === 0) {
    return { ok: false, reason: "Taxable Value is 0.00 — tax rate cannot be derived", details };
  }
  const taxRate = cgst / taxable;

  // Deduction rows (e.g. PM E-DRIVE Subsidy): each must carry a valid amount,
  // and Net Amount must equal Ex Showroom Price minus all of them.
  const deductions: DeductionRow[] = [];
  let deductionsTotal = 0;
  for (const d of deductionRows) {
    if (d.value === null || d.value.trim() === "") {
      return { ok: false, reason: `Deduction row "${d.labelFull}" has no amount`, details };
    }
    const paisa = parseAmount(d.value);
    if (paisa === null) {
      return {
        ok: false,
        reason: `Deduction row "${d.labelFull}" value "${d.value.trim()}" is not a valid amount`,
        details,
      };
    }
    deductions.push({ label: d.label, labelFull: d.labelFull, amount: paisa, y: d.y });
    deductionsTotal += paisa;
  }
  const expectedNet = exShowroom - deductionsTotal;
  if (expectedNet !== net) {
    return {
      ok: false,
      reason: `Amounts do not add up: ${formatAmount(exShowroom)} − ${formatAmount(deductionsTotal)} = ${formatAmount(expectedNet)}, but Net Amount is ${formatAmount(net)}`,
      details,
    };
  }

  const wordsLine = lines.find((l) => /^Rupees\b.*\bOnly$/.test(joinRuns(l.runs).trim()));
  const oldWords = wordsLine ? joinRuns(wordsLine.runs).trim() : null;
  if (!oldWords) {
    return { ok: false, reason: "Rupees-in-words line not found", details };
  }

  return {
    ok: true,
    details,
    lines,
    rows,
    byLabel,
    amounts,
    deductions,
    taxRate,
    oldWords,
  };
}

export async function parseInvoice(fileName: string, bytes: Uint8Array): Promise<ParsedRow> {
  let doc;
  try {
    doc = await loadDocument(bytes);
  } catch {
    return refusal(fileName, "Not a readable PDF document", emptyDetails());
  }
  const result = analyze(doc, fileName);
  if (!result.ok) return refusal(fileName, result.reason, result.details);

  const value = (label: TotalsLabel) => result.byLabel.get(label)!.value!.trim();
  return {
    fileName,
    status: "valid",
    refusalReason: null,
    errorReason: null,
    details: result.details,
    totals: {
      subTotal: value("Sub Total"),
      discount: value("Discount"),
      taxableValue: value("Taxable Value"),
      cgst: value("CGST"),
      sgst: value("SGST"),
      exShowroomPrice: value("Ex Showroom Price"),
      netAmount: value("Net Amount"),
      grandTotal: value("Grand Total"),
      roundOff: value("Round Off"),
      grandTotalAfterRoundOff: value("Grand Total (after Round Off)"),
      deductions: result.deductions.map((d) => ({ label: d.label, amount: formatAmount(d.amount) })),
      words: result.oldWords,
    },
  };
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

  // ICE invoices carry an "Engine#" column; EVs swap it for "Motor#".
  const engine = tableValueUnder("Engine#") !== null
    ? { label: "Engine#", value: tableValueUnder("Engine#") }
    : { label: "Motor#", value: tableValueUnder("Motor#") };

  return {
    invoiceNo: invoiceNoLine ? valueRightOf(invoiceNoLine, "Invoice #") : null,
    invoiceDate: dateLine ? valueRightOf(dateLine, "Date") : null,
    customer: customerLine ? valueRightOf(customerLine, "Name of the Customer") : null,
    model: tableValueUnder("Model"),
    engineNo: engine.value,
    engineLabel: engine.value === null ? null : engine.label,
    chassisNo: tableValueUnder("Chassis"),
  };
}

export { UNREADABLE };

const UNREADABLE = "~unreadable~";
