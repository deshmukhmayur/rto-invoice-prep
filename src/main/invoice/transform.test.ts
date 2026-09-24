import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { rupeesInWords, recomputeTotals, formatAmount, parseAmount } from "../../shared/totals";
import { RIGHT_EDGE, findTotalsRows, groupLines, joinRuns, parseAmount as _pa } from "./parse";
import { extractRuns, loadDocument, pageContentStream, pageCount } from "./pdf-ops";
import { PrepareRefusal, prepareInvoice, scanOps, transformStream, type NewValues } from "./transform";
import { parseInvoice } from "./parse";

void _pa;

const SAMPLE_PATH = join(__dirname, "../../../.scratch/samples/original.pdf");
const hasSample = (() => {
  try {
    readFileSync(SAMPLE_PATH);
    return true;
  } catch {
    return false;
  }
});

const originalBytes = () => new Uint8Array(readFileSync(SAMPLE_PATH));

describe("number-to-words (Indian system)", () => {
  test("sample totals", () => {
    expect(rupeesInWords(6593000)).toBe("Rupees Sixty Five Thousand Nine Hundred Thirty Only");
    expect(rupeesInWords(6383000)).toBe("Rupees Sixty Three Thousand Eight Hundred Thirty Only");
  });
  test("lakh/crore boundaries", () => {
    expect(rupeesInWords(100000 * 100)).toBe("Rupees One Lakh Only");
    expect(rupeesInWords(10000000 * 100)).toBe("Rupees One Crore Only");
    expect(rupeesInWords(100000000 * 100)).toBe("Rupees Ten Crore Only");
    expect(rupeesInWords(12345678900)).toBe("Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only");
    expect(rupeesInWords(1500 * 100)).toBe("Rupees One Thousand Five Hundred Only");
  });
});

describe("recomputeTotals (spec §2 worked example, to the paisa)", () => {
  test("55,872.88 sub total → the §2 table", () => {
    const sub = parseAmount("55,872.88")!;
    const n = recomputeTotals(sub);
    expect(formatAmount(n.taxable)).toBe("55,872.88");
    expect(formatAmount(n.cgst)).toBe("5,028.56");
    expect(formatAmount(n.sgst)).toBe("5,028.56");
    expect(formatAmount(n.grandTotal)).toBe("65,930.00");
    expect(formatAmount(n.roundOff)).toBe("0.00");
    expect(formatAmount(n.grandTotalAfterRoundOff)).toBe("65,930.00");
  });
});

/** A synthetic page-1 stream with the exact totals-block op pattern (spec §3). */
function buildStream(opts: {
  taxable: string;
  cgstBase: string;
  amounts: string[]; // the 9 value strings, discount first
  words: string;
}): string {
  const rows: [string, string | null][] = [
    ["Sub Total", "55,872.88"],
    ["Discount", opts.amounts[0]!],
    ["Taxable Value", opts.taxable],
    [`CGST on ${opts.cgstBase}`, opts.amounts[1]!],
    [`SGST on ${opts.cgstBase}`, opts.amounts[2]!],
    ["Ex Showroom Price", opts.amounts[3]!],
    ["Net Amount", opts.amounts[4]!],
    ["Grand Total", opts.amounts[5]!],
    ["Round Off", opts.amounts[6]!],
    ["Grand Total (after Round Off)", opts.amounts[7]!],
  ];
  const esc = (s: string) => s.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let y = 500;
  let out = "";
  for (const [label, value] of rows) {
    out += `BT /F2 8 Tf 1 0 0 1 28 ${y} Tm (${esc(label)}) Tj ET\n`;
    if (value !== null) out += `BT /F2 8 Tf 1 0 0 1 555.214 ${y} Tm (${esc(value)}) Tj ET\n`;
    y -= 9;
  }
  out += `BT /F2 8 Tf 1 0 0 1 28 380 Tm (${esc(opts.words)}) Tj ET\n`;
  return out;
}

const STUB_WIDTH = (text: string) => text.length * 4;

describe("transformStream on a synthetic stream", () => {
  const values: NewValues = {
    taxable: "10,028.56",
    cgstAmount: "902.57",
    sgstAmount: "902.57",
    exShowroomPrice: "11,833.70",
    netAmount: "11,833.70",
    grandTotal: "11,833.70",
    roundOff: "0.30",
    grandTotalAfterRoundOff: "11,834.00",
    words: "Rupees Eleven Thousand Eight Hundred Thirty Four Only",
  };
  const fontMap = new Map([["F2", "Helvetica"]]);

  test("thousands-boundary crossing re-anchors x to the right edge", () => {
    const stream = buildStream({
      taxable: "9,828.56",
      cgstBase: "9,828.56",
      amounts: ["9,828.56", "884.57", "884.57", "11,597.70", "11,597.70", "11,597.70", "0.30", "11,598.00"],
      words: "Rupees Nine Thousand Eight Hundred Fifty Only",
    });
    const out = transformStream(stream, fontMap, STUB_WIDTH, "9,828.56", values);
    const ops = scanOps(out);
    const taxable = ops.find((o) => o.text === "10,028.56")!;
    expect(taxable).toBeDefined();
    expect(taxable.x).toBeCloseTo(RIGHT_EDGE - STUB_WIDTH("10,028.56"), 5);
    // old strings are truly gone
    expect(out).not.toContain("9,828.56");
    expect(out).not.toContain("(Discount)");
    expect(out).not.toContain("11,597.70");
  });

  test("every rewritten amount is right-aligned; discount row emptied", () => {
    const stream = buildStream({
      taxable: "54,092.88",
      cgstBase: "54,092.88",
      amounts: ["1,780.00", "4,868.36", "4,868.36", "63,829.60", "63,829.60", "63,829.60", "0.40", "63,830.00"],
      words: "Rupees Sixty Three Thousand Eight Hundred Thirty Only",
    });
    const out = transformStream(stream, fontMap, STUB_WIDTH, "54,092.88", {
      ...values,
      taxable: "55,872.88",
      cgstAmount: "5,028.56",
      sgstAmount: "5,028.56",
      exShowroomPrice: "65,930.00",
      netAmount: "65,930.00",
      grandTotal: "65,930.00",
      roundOff: "0.00",
      grandTotalAfterRoundOff: "65,930.00",
      words: "Rupees Sixty Five Thousand Nine Hundred Thirty Only",
    });
    const yFor: Record<string, number> = { "55,872.88": 482, "5,028.56": 473, "65,930.00": 419, "0.00": 428 };
    for (const s of ["55,872.88", "5,028.56", "65,930.00", "0.00"]) {
      const op = scanOps(out).find((o) => o.text === s && o.x >= 500 && o.y === yFor[s]);
      expect(op).toBeDefined();
      expect(op!.x).toBeCloseTo(RIGHT_EDGE - STUB_WIDTH(s), 5);
    }
    expect(out).toContain("(CGST on 55,872.88)");
    expect(out).not.toContain("54,092.88");
    expect(out).toContain("(Rupees Sixty Five Thousand Nine Hundred Thirty Only)");
    // discount label + value both emptied, ops preserved
    const empties = scanOps(out).filter((o) => o.text === "");
    expect(empties.length).toBeGreaterThanOrEqual(2);
  });

  test("missing discount row refuses", () => {
    const stream = buildStream({
      taxable: "54,092.88",
      cgstBase: "54,092.88",
      amounts: ["1,780.00", "4,868.36", "4,868.36", "63,829.60", "63,829.60", "63,829.60", "0.40", "63,830.00"],
      words: "Rupees Sixty Three Thousand Eight Hundred Thirty Only",
    }).replace("(Discount) Tj", "(DiscounX) Tj");
    expect(() =>
      transformStream(stream, fontMap, STUB_WIDTH, "54,092.88", values),
    ).toThrow(PrepareRefusal);
  });
});

describe("prepareInvoice against the real sample (acceptance, ticket 15)", () => {
  test.skipIf(!hasSample)("reproduces §2's worked example to the paisa", async () => {
    const out = await prepareInvoice(originalBytes(), { version: "0.1.0" });
    const doc = await loadDocument(out);
    expect(pageCount(doc)).toBe(2);

    const stream = pageContentStream(doc, 0);
    const runs = extractRuns(stream);
    const lines = groupLines(runs);
    const { rows } = findTotalsRows(lines);
    const byLabel = new Map(rows.map((r) => [r.label, r]));

    // Discount row fully emptied (label + value), row kept in place at its original y.
    const origDoc = await loadDocument(originalBytes());
    const origRuns = extractRuns(pageContentStream(origDoc, 0));
    const origRows = findTotalsRows(groupLines(origRuns)).rows;
    const discountY = origRows.find((r) => r.label === "Discount")!.y;
    const discountLine = lines.find((l) => Math.abs(l.y - discountY) <= 1.5)!;
    expect(joinRuns(discountLine.runs).trim()).toBe("");
    expect(stream).not.toContain("1,780.00");
    expect(stream).not.toContain("(Discount)");

    expect(byLabel.get("Taxable Value")!.value).toBe("55,872.88");
    expect(byLabel.get("CGST")!.value).toBe("5,028.56");
    expect(byLabel.get("SGST")!.value).toBe("5,028.56");
    expect(byLabel.get("Ex Showroom Price")!.value).toBe("65,930.00");
    expect(byLabel.get("Net Amount")!.value).toBe("65,930.00");
    expect(byLabel.get("Grand Total")!.value).toBe("65,930.00");
    expect(byLabel.get("Round Off")!.value).toBe("0.00");
    expect(byLabel.get("Grand Total (after Round Off)")!.value).toBe("65,930.00");

    // CGST/SGST label base text rewritten.
    const labelText = (y: number) => joinRuns((lines.find((l) => l.y === y) ?? { runs: [] }).runs.filter((r) => r.x < 500)).trim();
    const cgstY = origRows.find((r) => r.label === "CGST")!.y;
    const sgstY = origRows.find((r) => r.label === "SGST")!.y;
    expect(labelText(cgstY)).toBe("CGST on 55,872.88");
    expect(labelText(sgstY)).toBe("SGST on 55,872.88");
    expect(stream).not.toContain("54,092.88");

    // Words regenerated correctly.
    const wordsLine = lines.find((l) => l.runs.some((r) => r.text.startsWith("Rupees")))!;
    expect(joinRuns(wordsLine.runs).trim()).toBe("Rupees Sixty Five Thousand Nine Hundred Thirty Only");
    expect(stream).not.toContain("Sixty Three Thousand");
  });

  test.skipIf(!hasSample)("rewritten amounts are right-aligned to 586.3 with real Helvetica metrics", async () => {
    const origDoc = await loadDocument(originalBytes());
    const origLines = groupLines(extractRuns(pageContentStream(origDoc, 0)));
    const origRows = findTotalsRows(origLines).rows;
    const yOf = new Map(origRows.map((r) => [r.label, r.y]));

    const out = await prepareInvoice(originalBytes(), { version: "0.1.0" });
    const doc = await loadDocument(out);
    const helv = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const ops = scanOps(pageContentStream(doc, 0));
    const cases: [string, string][] = [
      ["Taxable Value", "55,872.88"],
      ["CGST", "5,028.56"],
      ["SGST", "5,028.56"],
      ["Ex Showroom Price", "65,930.00"],
      ["Grand Total (after Round Off)", "65,930.00"],
      ["Round Off", "0.00"],
    ];
    for (const [label, s] of cases) {
      const op = ops.find((o) => o.text === s && o.x >= 500 && Math.abs(o.y - yOf.get(label)!) <= 1.5);
      expect(op).toBeDefined();
      const expected = RIGHT_EDGE - helv.widthOfTextAtSize(s, op!.size);
      expect(Math.abs(op!.x - expected)).toBeLessThanOrEqual(0.5);
    }
  });

  test.skipIf(!hasSample)("page 2 stream and images are untouched; custom metadata added", async () => {
    const before = await loadDocument(originalBytes());
    const out = await prepareInvoice(originalBytes(), { version: "0.1.0" });
    const after = await loadDocument(out);

    expect(pageContentStream(before, 1)).toBe(pageContentStream(after, 1));
    // page 1 ruling lines preserved: same number of `re f` fills
    const reBefore = (pageContentStream(before, 0).match(/\bre\b/g) ?? []).length;
    const reAfter = (pageContentStream(after, 0).match(/\bre\b/g) ?? []).length;
    expect(reAfter).toBe(reBefore);

    // Original metadata preserved + custom keys added.
    const origInfo = before.context.lookupMaybe(before.context.trailerInfo.Info, PDFDict);
    const infoDict = after.context.lookupMaybe(after.context.trailerInfo.Info, PDFDict)!;
    expect(infoDict.get(PDFName.of("RTOInvoicePrepTool"))?.toString()).toContain("RTO Invoice Prep");
    expect(infoDict.get(PDFName.of("RTOInvoicePrepVersion"))?.toString()).toContain("0.1.0");
    expect(infoDict.get(PDFName.of("RTOInvoicePrepModification"))?.toString()).toContain("Discount removal for RTO compliance");
    // every original Info key still present with its value
    if (origInfo) {
      for (const [key, value] of origInfo.entries()) {
        expect(infoDict.get(key)?.toString()).toBe(value.toString());
      }
    }
  });

  test.skipIf(!hasSample)("a prepared file is refused on re-ingest (no Discount row — no double processing)", async () => {
    const out = await prepareInvoice(originalBytes(), { version: "0.1.0" });
    const row = await parseInvoice("prepared.pdf", out);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("No Discount row found");
  });
});
