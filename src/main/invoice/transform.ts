import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFString,
  StandardFonts,
} from "pdf-lib";
import { rupeesInWords, recomputeTotals, formatAmount } from "../../shared/totals";
import {
  RIGHT_EDGE,
  analyze,
  findTotalsRows,
  groupLines,
  joinRuns,
  type TotalsLabel,
} from "./parse";
import { loadDocument, pageContentStream, pageFontMap, unescapePdfString, type TextRun } from "./pdf-ops";

/** Thrown when a file passed validation at parse time but cannot be transformed — never partial output. */
export class PrepareRefusal extends Error {}

export type Op = {
  text: string;
  x: number;
  y: number;
  yText: string;
  font: string;
  size: number;
  tmStart: number;
  tmEnd: number;
  strStart: number;
  strEnd: number;
};

/**
 * Scan a validated stream into `(string) Tj` ops with the spans of their
 * positioning op and string literal, in op order (same order as extractRuns).
 */
export function scanOps(stream: string): Op[] {
  const ops: Op[] = [];
  const re = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm|\(((?:[^()\\]|\\.)*)\)\s*Tj|\/(\w+)\s+([\d.]+)\s+Tf/g;
  let font = "";
  let size = 0;
  let x = 0;
  let y = 0;
  let yText = "0";
  let tmStart = -1;
  let tmEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stream))) {
    if (m[1] !== undefined) {
      x = Number(m[1]);
      y = Number(m[2]);
      yText = m[2]!;
      tmStart = m.index;
      tmEnd = re.lastIndex;
    } else if (m[3] !== undefined) {
      const strStart = m.index + 1;
      ops.push({
        text: unescapePdfString(m[3]),
        x,
        y,
        yText,
        font,
        size,
        tmStart,
        tmEnd,
        strStart,
        strEnd: strStart + m[3].length,
      });
    } else {
      font = m[4]!;
      size = Number(m[5]);
    }
  }
  return ops;
}

type Edit = { start: number; end: number; replacement: string };

function applyEdits(stream: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.end > sorted[i - 1]!.start)
      throw new PrepareRefusal(
        `internal: overlapping stream edits [${sorted[i - 1]!.start},${sorted[i - 1]!.end}) vs [${sorted[i]!.start},${sorted[i]!.end}) at "${stream.slice(sorted[i]!.start, sorted[i]!.end)}"`,
      );
  }
  let out = stream;
  for (const e of sorted) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return out;
}

function formatX(x: number): string {
  return String(Math.round(x * 1000) / 1000);
}

export type NewValues = {
  taxable: string;
  cgstAmount: string;
  sgstAmount: string;
  exShowroomPrice: string;
  netAmount: string;
  grandTotal: string;
  roundOff: string;
  grandTotalAfterRoundOff: string;
  words: string;
};

/**
 * Content-stream surgery (spec §3): empty the Discount row, rewrite the
 * affected amounts right-aligned at `x = 586.3 − width(newString)`, rewrite
 * the CGST/SGST label base text, and regenerate the rupees-in-words line.
 * `fontMap` maps resource keys to BaseFont names; `widthOf` must use pdf-lib's
 * standard Helvetica metrics.
 */
export function transformStream(
  stream: string,
  fontMap: Map<string, string>,
  widthOf: (text: string, baseFont: string, size: number) => number,
  oldTaxable: string,
  newValues: NewValues,
): string {
  const ops = scanOps(stream);
  if (ops.length === 0) throw new PrepareRefusal("page 1 content stream has no text ops");

  type Run = TextRun & { op: Op };
  type RunLine = { y: number; runs: Run[] };
  const runs: Run[] = ops.map((op) => ({ x: op.x, y: op.y, text: op.text, font: op.font, size: op.size, op }));
  const lines = groupLines(runs) as unknown as RunLine[];
  const { rows } = findTotalsRows(lines);
  const byLabel = new Map(rows.map((r) => [r.label as TotalsLabel, r]));
  const lineOf = (rowY: number) => lines.find((l) => Math.abs(l.y - rowY) <= 1.5);

  const edits: Edit[] = [];

  // 1. Empty the whole Discount row (label + value) — user override, spec §2.
  const discountRow = byLabel.get("Discount");
  if (!discountRow) throw new PrepareRefusal("No Discount row found");
  const discountLine = lineOf(discountRow.y);
  if (!discountLine) throw new PrepareRefusal("Discount row line not found");
  for (const run of discountLine.runs) {
    edits.push({ start: run.op.strStart, end: run.op.strEnd, replacement: "" });
  }

  // 2. Rewrite amounts right-aligned to the sample's right edge.
  const amountTargets: [TotalsLabel, string][] = [
    ["Taxable Value", newValues.taxable],
    ["CGST", newValues.cgstAmount],
    ["SGST", newValues.sgstAmount],
    ["Ex Showroom Price", newValues.exShowroomPrice],
    ["Net Amount", newValues.netAmount],
    ["Grand Total", newValues.grandTotal],
    ["Round Off", newValues.roundOff],
    ["Grand Total (after Round Off)", newValues.grandTotalAfterRoundOff],
  ];
  for (const [label, newText] of amountTargets) {
    const row = byLabel.get(label);
    if (!row || row.value === null) throw new PrepareRefusal(`${label} amount not found`);
    const line = lineOf(row.y);
    if (!line) throw new PrepareRefusal(`${label} row line not found`);
    const valueRuns = line.runs.filter((r) => r.x >= 500 && r.text.trim());
    if (valueRuns.length === 0) throw new PrepareRefusal(`${label} amount not found at the amount column`);
    if (valueRuns.length === 1 && valueRuns[0]!.text.trim() !== row.value.trim()) {
      throw new PrepareRefusal(`${label} amount changed under us — refusing`);
    }
    const [first, ...rest] = valueRuns;
    const base = fontMap.get(first!.op.font);
    if (!base) throw new PrepareRefusal(`Font resource "${first!.op.font}" not found in page resources`);
    const newX = RIGHT_EDGE - widthOf(newText, base, first!.op.size);
    if (first!.op.tmStart < 0) throw new PrepareRefusal(`${label} amount has no absolute position`);
    edits.push({
      start: first!.op.tmStart,
      end: first!.op.tmEnd,
      replacement: `1 0 0 1 ${formatX(newX)} ${first!.op.yText} Tm`,
    });
    edits.push({ start: first!.op.strStart, end: first!.op.strEnd, replacement: escapePdfString(newText) });
    for (const run of rest) {
      edits.push({ start: run.op.strStart, end: run.op.strEnd, replacement: "" });
    }
  }

  // 3. Rewrite the CGST/SGST label base text (left-aligned; position untouched).
  for (const [label, newBase] of [
    ["CGST", newValues.taxable],
    ["SGST", newValues.taxable],
  ] as const) {
    const row = byLabel.get(label);
    if (!row) throw new PrepareRefusal(`${label} row not found`);
    const line = lineOf(row.y);
    if (!line) throw new PrepareRefusal(`${label} row line not found`);
    const baseRuns = line.runs.filter((r) => r.x < 500 && r.text.includes(oldTaxable));
    if (baseRuns.length !== 1) {
      throw new PrepareRefusal(`${label} label base "${oldTaxable}" not found as a single string`);
    }
    const run = baseRuns[0]!;
    // Offsets are computed on unescaped text; a raw literal with escapes would
    // shift them — refuse rather than corrupt the stream.
    if (stream.slice(run.op.strStart, run.op.strEnd).includes("\\")) {
      throw new PrepareRefusal(`${label} label string contains escape sequences — refusing`);
    }
    const start = run.op.strStart + run.text.indexOf(oldTaxable);
    edits.push({
      start,
      end: start + oldTaxable.length,
      replacement: escapePdfString(newBase),
    });
  }

  // 4. Regenerate the rupees-in-words line (left-aligned; position untouched).
  const wordsLine = lines.find((l) => /^Rupees\b.*\bOnly$/.test(joinRuns(l.runs).trim()));
  if (!wordsLine) throw new PrepareRefusal("Rupees-in-words line not found");
  const wordsRuns = wordsLine.runs.filter((r) => r.text.trim());
  const [firstWords, ...restWords] = wordsRuns;
  edits.push({
    start: firstWords!.op.strStart,
    end: firstWords!.op.strEnd,
    replacement: escapePdfString(newValues.words),
  });
  for (const run of restWords) {
    edits.push({ start: run.op.strStart, end: run.op.strEnd, replacement: "" });
  }

  return applyEdits(stream, edits);
}

/** Editable strings are WinAnsi-safe ASCII (digits, commas, periods, letters, spaces). */
function escapePdfString(s: string): string {
  if (!/^[\x20-\x7E]*$/.test(s)) throw new PrepareRefusal(`refusing to emit non-ASCII string "${s}"`);
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

type Metrics = { widthOf: (text: string, baseFont: string, size: number) => number };

let metricsPromise: Promise<Metrics> | null = null;

/** pdf-lib standard-font metrics, loaded once (throwaway doc — never touches the output). */
async function loadMetrics(): Promise<Metrics> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  return {
    widthOf: (text, baseFont, size) => {
      if (baseFont.startsWith("Helvetica-Bold")) return helvBold.widthOfTextAtSize(text, size);
      if (baseFont.startsWith("Helvetica")) return helv.widthOfTextAtSize(text, size);
      if (baseFont.startsWith("Times-Bold")) return timesBold.widthOfTextAtSize(text, size);
      if (baseFont.startsWith("Times")) return times.widthOfTextAtSize(text, size);
      throw new PrepareRefusal(`no metrics for font "${baseFont}"`);
    },
  };
}

function metrics(): Promise<Metrics> {
  metricsPromise ??= loadMetrics();
  return metricsPromise;
}

export type PreparedMetadata = { version: string };

/**
 * Full transformation of a PDF file (spec §2/§3): re-validate, perform the
 * surgery on page 1's content stream, add the custom metadata, and save.
 * Throws `PrepareRefusal` — nothing partial is ever emitted.
 */
export async function prepareInvoice(bytes: Uint8Array, meta: PreparedMetadata): Promise<Uint8Array> {
  const doc = await loadDocument(bytes).catch(() => {
    throw new PrepareRefusal("Not a readable PDF document");
  });
  const analysis = analyze(doc, "invoice.pdf");
  if (!analysis.ok) throw new PrepareRefusal(analysis.reason);

  const stream = pageContentStream(doc, 0);
  const fontMap = pageFontMap(doc, 0);
  const { widthOf } = await metrics();

  const subTotal = analysis.amounts.get("Sub Total")!;
  const taxRate = analysis.amounts.get("CGST")! / analysis.amounts.get("Taxable Value")!;
  const deductionsTotal = analysis.deductions.reduce((sum, d) => sum + d.amount, 0);
  const t = recomputeTotals(subTotal, taxRate, deductionsTotal);
  const newValues: NewValues = {
    taxable: formatAmount(t.taxable),
    cgstAmount: formatAmount(t.cgst),
    sgstAmount: formatAmount(t.sgst),
    exShowroomPrice: formatAmount(t.exShowroom),
    netAmount: formatAmount(t.net),
    grandTotal: formatAmount(t.grandTotal),
    roundOff: formatAmount(t.roundOff),
    grandTotalAfterRoundOff: formatAmount(t.grandTotalAfterRoundOff),
    words: rupeesInWords(t.grandTotalAfterRoundOff),
  };
  const oldTaxable = analysis.byLabel.get("Taxable Value")!.value!.trim();

  const newStream = transformStream(stream, fontMap, widthOf, oldTaxable, newValues);

  // Replace page 1's content stream with the re-compressed surgery result.
  const compressed = await deflateBytes(
    Uint8Array.from(newStream, (c) => c.charCodeAt(0) & 0xff),
  );
  const page = doc.getPage(0);
  const contents = doc.context.register(
    PDFRawStream.of(
      doc.context.obj({ Filter: PDFName.of("FlateDecode"), Length: compressed.length }),
      compressed,
    ),
  );
  page.node.set(PDFName.of("Contents"), contents);

  setCustomMetadata(doc, meta);

  return (await doc.save({ useObjectStreams: false })) as Uint8Array;
}

/** zlib-format deflate (RFC 1950), same output as node's deflateSync. */
async function deflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function setCustomMetadata(doc: PDFDocument, meta: PreparedMetadata): void {
  let info = doc.context.lookupMaybe(doc.context.trailerInfo.Info, PDFDict);
  if (!info) {
    info = doc.context.obj({});
    doc.context.trailerInfo.Info = doc.context.register(info);
  }
  info.set(PDFName.of("RTOInvoicePrepTool"), PDFString.of("RTO Invoice Prep"));
  info.set(PDFName.of("RTOInvoicePrepVersion"), PDFString.of(meta.version));
  info.set(PDFName.of("RTOInvoicePrepProcessed"), PDFString.of(new Date().toISOString()));
  info.set(PDFName.of("RTOInvoicePrepModification"), PDFString.of("Discount removal for RTO compliance"));
}
