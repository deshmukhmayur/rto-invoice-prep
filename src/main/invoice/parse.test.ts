import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, PDFDict, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream, type PDFRef } from "pdf-lib";
import { parseInvoice } from "./parse";
import { loadDocument } from "./pdf-ops";

const SAMPLE_PATH = join(__dirname, "../../../.scratch/samples/original.pdf");
const hasSample = (() => {
  try {
    readFileSync(SAMPLE_PATH);
    return true;
  } catch {
    return false;
  }
})();

const originalBytes = () => new Uint8Array(readFileSync(SAMPLE_PATH));

/** Decode page 1's content stream, apply string replacements, and re-embed it raw. */
async function withMutatedStream(
  mutate: (stream: string) => string,
  also?: (doc: PDFDocument) => void,
): Promise<Uint8Array> {
  const doc = await loadDocument(originalBytes());
  const page = doc.getPage(0);
  const contentsRef = page.node.get(PDFName.of("Contents")) as PDFRef;
  const stream = doc.context.lookup(contentsRef) as PDFRawStream;
  const text = new TextDecoder("latin1").decode(decodePDFRawStream(stream).decode());
  const mutated = mutate(text);
  const bytes = new TextEncoder().encode(mutated);
  const dict = stream.dict.clone(doc.context);
  dict.delete(PDFName.of("Filter"));
  dict.set(PDFName.of("Length"), PDFNumber.of(bytes.length));
  doc.context.assign(contentsRef, PDFRawStream.of(dict, bytes));
  also?.(doc);
  return (await doc.save({ useObjectStreams: false })) as Uint8Array;
}

const replaceNth = (haystack: string, find: string, repl: string, n: number): string => {
  let index = -1;
  for (let i = 0; i < n; i++) {
    index = haystack.indexOf(find, index + 1);
    if (index === -1) throw new Error(`occurrence ${n} of ${JSON.stringify(find)} not found`);
  }
  return haystack.slice(0, index) + repl + haystack.slice(index + find.length);
};

const EV_SAMPLE_PATH = join(__dirname, "../../../.scratch/samples/03677.pdf");
const hasEvSample = (() => {
  try {
    readFileSync(EV_SAMPLE_PATH);
    return true;
  } catch {
    return false;
  }
})();

const evBytes = () => new Uint8Array(readFileSync(EV_SAMPLE_PATH));

describe("parseInvoice against the real sample", () => {
  test.skipIf(!hasSample)("original.pdf parses as valid with the sample's numbers", async () => {
    const row = await parseInvoice("original.pdf", originalBytes());
    expect(row.status).toBe("valid");
    expect(row.totals).toEqual({
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
    });
    // Details depend on the local (untracked, real-data) sample PDF, so assert
    // presence rather than exact values.
    expect(row.details).toMatchObject({
      invoiceNo: expect.any(String),
      customer: expect.any(String),
      chassisNo: expect.any(String),
      engineNo: expect.any(String),
    });
  });

  test.skipIf(!hasEvSample)("03677.pdf (EV) parses valid with the PM E-DRIVE Subsidy deduction row", async () => {
    const row = await parseInvoice("03677.pdf", evBytes());
    expect(row.status).toBe("valid");
    expect(row.totals?.deductions).toEqual([{ label: "PM E-DRIVE Subsidy", amount: "5,000.00" }]);
    expect(row.totals?.subTotal).toBe("124,752.38");
    expect(row.totals?.netAmount).toBe("117,499.70");
    // EVs have no engine — the vehicle-table Motor# column feeds the same slot.
    expect(row.details.engineNo).toBe("ECD001T6J14867");
    expect(row.details.engineLabel).toBe("Motor#");
    expect(row.details.chassisNo).toBe("MBLCEW11XT6J03677");
  });
});

describe("§4 refusals (synthetic variants of the sample stream)", () => {
  test.skipIf(!hasSample)("no Discount row found", async () => {
    const bytes = await withMutatedStream((s) => s.replace("(Discount)Tj", "(DiscounX)Tj"));
    const row = await parseInvoice("no-discount.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("No Discount row found");
  });

  test.skipIf(!hasSample)("Discount is 0.00 is refused distinctly", async () => {
    const bytes = await withMutatedStream((s) => s.replace("(1,780.00)Tj", "(0.00)Tj"));
    const row = await parseInvoice("zero-discount.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("Discount is 0.00");
  });

  test.skipIf(!hasSample)("multiple Discount rows refused", async () => {
    const bytes = await withMutatedStream((s) =>
      s.replace("(Discount)Tj", "(Discount)Tj 1 0 0 1 28 352 Tm (Discount) Tj"),
    );
    const row = await parseInvoice("two-discounts.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("Multiple Discount rows found");
  });

  test.skipIf(!hasSample)("extra totals row refused, naming the observed label", async () => {
    const bytes = await withMutatedStream((s) =>
      s.replace("(1,780.00)Tj", "(1,780.00)Tj 1 0 0 1 28 353 Tm (Insurance) Tj 1 0 0 1 555.214 353 Tm (500.00) Tj"),
    );
    const row = await parseInvoice("insurance.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("Insurance");
  });

  test.skipIf(!hasSample)("deduction row in the Ex Showroom → Net gap with broken Net identity refused", async () => {
    // Insert a subsidy row in the allowed gap but leave Net Amount unchanged.
    const bytes = await withMutatedStream((s) => {
      const at = s.indexOf("(Net Amount)");
      const valueAt = s.indexOf("(63,829.60)Tj", at);
      if (valueAt === -1) throw new Error("Net Amount value not found");
      const blockEnd = s.indexOf("ET", valueAt);
      // Self-contained BT…ET block so existing ops keep their positioning.
      const insert =
        "BT\r\n/F2\r\n 8 Tf\r\n1 0 0 1 28 312 Tm\r\n(PM E-DRIVE Subsidy)Tj\r\n1 0 0 1 555.214 312 Tm\r\n(1,000.00)Tj\r\nET\r\n";
      return s.slice(0, blockEnd) + insert + s.slice(blockEnd);
    });
    const row = await parseInvoice("subsidy-broken.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("63,829.60");
    expect(row.refusalReason).toContain("1,000.00");
  });

  test.skipIf(!hasSample)("broken Sub − Discount = Taxable identity refused with observed numbers", async () => {
    const bytes = await withMutatedStream((s) =>
      replaceNth(s, "(54,092.88)Tj", "(54,092.90)Tj", 1),
    );
    const row = await parseInvoice("broken-identity.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("55,872.88");
    expect(row.refusalReason).toContain("1,780.00");
    expect(row.refusalReason).toContain("54,092.90");
  });

  test.skipIf(!hasSample)("unextractable field refused, naming the field", async () => {
    const bytes = await withMutatedStream((s) =>
      replaceNth(s, "(54,092.88)Tj", "(N/A)Tj", 1),
    );
    const row = await parseInvoice("bad-taxable.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("Taxable Value");
  });

  test.skipIf(!hasSample)("moved row (label at unexpected x) refused", async () => {
    const bytes = await withMutatedStream((s) =>
      s.replace("1 0 0 1 28 358.083 Tm", "1 0 0 1 200 358.083 Tm"),
    );
    const row = await parseInvoice("moved-row.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("Template validation failed");
  });

  test.skipIf(!hasSample)("TJ array op refused loudly", async () => {
    const bytes = await withMutatedStream((s) => s.replace("(Discount)Tj", "[(Discount)] TJ"));
    const row = await parseInvoice("tj.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("TJ");
  });

  test.skipIf(!hasSample)("subset (non standard-14) font refused loudly", async () => {
    const bytes = await withMutatedStream((s) => s, (doc) => {
      const page = doc.getPage(0);
      const fonts = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
      if (!fonts) throw new Error("no fonts");
      for (const [, value] of fonts.entries()) {
        doc.context.lookupMaybe(value, PDFDict)?.set(PDFName.of("BaseFont"), PDFName.of("ABCDEF+Helvetica"));
      }
    });
    const row = await parseInvoice("subset-font.pdf", bytes);
    expect(row.status).toBe("refused");
    expect(row.refusalReason).toContain("Template validation failed");
  });
});

describe("formatAmount", () => {
  test("Indian digit grouping", async () => {
    const { formatAmount } = await import("./parse");
    expect(formatAmount(5587288)).toBe("55,872.88");
    expect(formatAmount(6593000)).toBe("65,930.00");
    expect(formatAmount(-40)).toBe("-0.40");
    expect(formatAmount(100040)).toBe("1,000.40");
  });
});
