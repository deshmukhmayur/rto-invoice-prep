/** Amount math and formatting shared by the main process (transformation) and renderer (facsimile). */

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

/**
 * Recompute the totals block as if the discount were zero (spec §2), all in
 * paisa. The tax rate is derived from the invoice (cgst ÷ taxable — 9% for
 * ICE, 2.5% for EVs), and post-tax deductions (e.g. PM E-DRIVE Subsidy) are
 * kept: Net = Ex Showroom − deductions.
 */
export function recomputeTotals(
  subTotal: number,
  taxRate = 0.09,
  deductionsTotal = 0,
): {
  taxable: number;
  cgst: number;
  sgst: number;
  exShowroom: number;
  net: number;
  grandTotal: number;
  roundOff: number;
  grandTotalAfterRoundOff: number;
} {
  const taxable = subTotal;
  const cgst = Math.round(taxable * taxRate);
  const sgst = cgst;
  const exShowroom = taxable + cgst + sgst;
  const net = exShowroom - deductionsTotal;
  const grandTotal = net;
  const roundOff = Math.round(grandTotal / 100) * 100 - grandTotal;
  return {
    taxable,
    cgst,
    sgst,
    exShowroom,
    net,
    grandTotal,
    roundOff,
    grandTotalAfterRoundOff: grandTotal + roundOff,
  };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  return TENS[Math.floor(n / 10)]! + (n % 10 ? ` ${ONES[n % 10]}` : "");
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/** Indian-system number to words: `65930 → "Sixty Five Thousand Nine Hundred Thirty"`. */
export function numberToWordsIndian(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/** The regenerated rupees-in-words line (spec §2 step 6). */
export function rupeesInWords(paisa: number): string {
  return `Rupees ${numberToWordsIndian(Math.floor(Math.abs(paisa) / 100))} Only`;
}
