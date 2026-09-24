import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, PDFDict, PDFArray } from "pdf-lib";

export type TextRun = { x: number; y: number; text: string; font: string; size: number };

/** Decode a page's content stream(s) into raw latin1 text. */
export function pageContentStream(doc: PDFDocument, pageIndex: number): string {
  const page = doc.getPage(pageIndex);
  const contents = doc.context.lookup(page.node.Contents());
  const streams: PDFRawStream[] = [];
  if (contents instanceof PDFRawStream) {
    streams.push(contents);
  } else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const el = doc.context.lookup(contents.get(i));
      if (el instanceof PDFRawStream) streams.push(el);
    }
  }
  return streams
    .map((s) => new TextDecoder("latin1").decode(decodePDFRawStream(s).decode()))
    .join("\n");
}

const STRING_TJ = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;

/**
 * Op-pattern check (spec §3): page-1 text must be absolute-position
 * `BT … 1 0 0 1 x y Tm (string) Tj … ET` runs in standard fonts.
 * Returns a drift description or null when the pattern holds.
 */
export function checkContentStreamPattern(stream: string): string | null {
  const positioningOps = stream.match(/\b(TJ|Tj|'|"|Td|TD|T\*|TL|Tz|Ts)\b/g) ?? [];
  const tjs = positioningOps.filter((op) => op === "TJ").length;
  if (tjs > 0) return `found ${tjs} TJ array op(s) — expected only absolute-position Tj runs`;

  // Every Tj must be a simple `(string) Tj` (no escape-heavy hex strings, no arrays).
  const simpleTjs = (stream.match(STRING_TJ) ?? []).length;
  const bareTj = (stream.match(/\bTj\b/g) ?? []).length;
  if (simpleTjs !== bareTj) {
    return `${bareTj - simpleTjs} Tj op(s) not of the expected (string) Tj form`;
  }

  // Only absolute Tm positioning allowed inside text blocks.
  const blocks = stream.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of blocks) {
    if (/\b(Td|TD|T\*|TL|Tz|Ts)\b/.test(block)) {
      return "text block uses relative positioning operators (Td/TD/T*/TL/Tz/Ts)";
    }
    const tms = block.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g) ?? [];
    const tmCount = (block.match(/\bTm\b/g) ?? []).length;
    if (tms.length !== tmCount) {
      return "Tm matrices other than the expected `1 0 0 1 x y Tm` form";
    }
  }
  return null;
}

/** Extract `(x, y, string)` runs from a stream already checked against the op pattern. */
export function extractRuns(stream: string): TextRun[] {
  const runs: TextRun[] = [];
  let font = "";
  let size = 0;
  let x = 0;
  let y = 0;

  const tokenRe =
    /\/(\w+)\s+([\d.]+)\s+Tf|1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm|\(((?:[^()\\]|\\.)*)\)\s*Tj|BT|ET/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(stream))) {
    if (m[1] !== undefined) {
      font = m[1];
      size = Number(m[2]);
    } else if (m[3] !== undefined) {
      x = Number(m[3]);
      y = Number(m[4]);
    } else if (m[5] !== undefined) {
      runs.push({ x, y, text: unescapePdfString(m[5]), font, size });
    }
  }
  return runs;
}

function unescapePdfString(s: string): string {
  return s.replace(/\\(.)/g, (_, c: string) => {
    switch (c) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case "b": return "\b";
      case "f": return "\f";
      default: return c;
    }
  });
}

const STANDARD_14 = new Set([
  "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
  "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic",
  "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique",
  "Symbol", "ZapfDingbats",
]);

/**
 * Font check (spec §3): every text font on the page must be a non-embedded
 * standard-14 Type1 font. Returns a drift description or null.
 */
export function checkFonts(doc: PDFDocument, pageIndex: number): string | null {
  const page = doc.getPage(pageIndex);
  const fontsDict = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
  if (!fontsDict) return "page has no font resources";
  for (const [, value] of fontsDict.entries()) {
    const font = doc.context.lookupMaybe(value, PDFDict);
    if (!font) return "font resource is not a font dictionary";
    const subtype = font.lookup(PDFName.of("Subtype"));
    if (subtype !== PDFName.of("Type1")) {
      return `font is not a standard Type1 font (Subtype ${subtype?.toString()})`;
    }
    const baseFont = font.lookup(PDFName.of("BaseFont"));
    const name = baseFont instanceof PDFName ? baseFont.asString().replace("/", "") : "";
    if (!STANDARD_14.has(name)) return `font "${name}" is not a standard-14 font`;
    const descriptor = font.lookup(PDFName.of("FontDescriptor"));
    if (descriptor instanceof PDFDict) {
      const embedded = ["FontFile", "FontFile2", "FontFile3"].some((k) =>
        descriptor.lookup(PDFName.of(k)) !== undefined);
      if (embedded) return `font "${name}" is embedded`;
      return `font "${name}" has a font descriptor (possible subset/embedding)`;
    }
  }
  return null;
}

export async function loadDocument(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
    ignoreEncryption: false,
    throwOnInvalidObject: false,
  });
}

export function pageCount(doc: PDFDocument): number {
  return doc.getPageCount();
}
