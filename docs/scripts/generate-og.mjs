// Generates src/public/og.png (1200x630) for social cards. Run once with
// `bun scripts/generate-og.mjs` after changing branding; the output is
// committed so builds don't depend on sharp at render time.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const iconPath = path.join(root, 'src/public/icon.png');
const outPath = path.join(root, 'src/public/og.png');

const W = 1200;
const H = 630;

// Ledger-paper background with a white invoice card on the right: the
// discount row struck in red, the corrected grand total stamped green.
const svg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
			<feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1c2b3a" flood-opacity="0.18"/>
		</filter>
	</defs>

	<rect width="${W}" height="${H}" fill="#eef1f3"/>
	<!-- faint ledger rules -->
	${[104, 168, 232, 296, 360, 424, 488, 552].map((y) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#1c2b3a" stroke-opacity="0.05" stroke-width="1"/>`).join('\n\t')}

	<!-- left: brand block -->
	<rect x="80" y="88" width="64" height="64" rx="14" fill="#005fb8"/>
	<rect x="92" y="106" width="28" height="36" rx="3" fill="#ffffff"/>
	<line x1="98" y1="114" x2="114" y2="114" stroke="#005fb8" stroke-width="4" stroke-linecap="round"/>
	<line x1="98" y1="124" x2="114" y2="124" stroke="#005fb8" stroke-width="4" stroke-linecap="round"/>
	<line x1="98" y1="134" x2="108" y2="134" stroke="#005fb8" stroke-width="4" stroke-linecap="round"/>

	<text x="80" y="230" font-family="Segoe UI, Arial, sans-serif" font-size="21"
		fill="#5a6b78" letter-spacing="5">PREPARE DEALERSHIP INVOICES</text>
	<text x="80" y="264" font-family="Segoe UI, Arial, sans-serif" font-size="21"
		fill="#5a6b78" letter-spacing="5">FOR RTO REGISTRATION</text>

	<text x="80" y="348" font-family="Segoe UI, Arial, sans-serif" font-weight="700"
		font-size="60" fill="#1c2b3a">RTO Invoice Prep</text>

	<!-- one red line through the discount -->
	<text x="80" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="31"
		fill="#1c2b3a">One</text>
	<text x="143" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="31"
		fill="#be3a1d" font-weight="600">red line</text>
	<text x="276" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="31"
		fill="#1c2b3a">through the discount.</text>

	<text x="80" y="500" font-family="Consolas, 'IBM Plex Mono', monospace" font-size="22"
		fill="#5a6b78">Free · Local-first · Windows</text>

	<text x="80" y="560" font-family="Consolas, 'IBM Plex Mono', monospace" font-size="22"
		fill="#005fb8">deshmukhmayur.github.io/rto-invoice-prep</text>

	<!-- right: corrected invoice card -->
	<g filter="url(#card-shadow)">
		<rect x="680" y="90" width="440" height="450" rx="8" fill="#ffffff" stroke="#cdd8de"/>
	</g>
	<text x="712" y="140" font-family="Consolas, monospace" font-size="17"
		font-weight="700" fill="#1c2b3a" letter-spacing="3">TAX INVOICE — RTO COPY</text>
	<line x1="712" y1="160" x2="1088" y2="160" stroke="#1c2b3a" stroke-width="2"/>

	<text x="712" y="200" font-family="Consolas, monospace" font-size="16" fill="#1c2b3a">Motorcycle — ex-showroom</text>
	<text x="1088" y="200" font-family="Consolas, monospace" font-size="16" fill="#1c2b3a" text-anchor="end">1,10,000.00</text>

	<!-- struck discount row -->
	<rect x="700" y="222" width="400" height="34" rx="3" fill="#f6e4de"/>
	<text x="712" y="246" font-family="Consolas, monospace" font-size="18" fill="#be3a1d">Less: Dealer Discount</text>
	<text x="1076" y="246" font-family="Consolas, monospace" font-size="18" fill="#be3a1d" text-anchor="end">10,000.00</text>
	<line x1="708" y1="240" x2="1068" y2="240" stroke="#be3a1d" stroke-width="4" stroke-linecap="round"/>

	<!-- REMOVED FOR RTO stamp -->
	<g transform="rotate(-6 930 292)">
		<rect x="836" y="274" width="170" height="36" rx="4" fill="none" stroke="#1f6b4e" stroke-width="3"/>
		<text x="921" y="299" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700"
			fill="#1f6b4e" text-anchor="middle" letter-spacing="2">REMOVED FOR RTO</text>
	</g>

	<text x="712" y="360" font-family="Consolas, monospace" font-size="18" fill="#1c2b3a">Total taxable value</text>
	<text x="1088" y="360" font-family="Consolas, monospace" font-size="18" fill="#1c2b3a" text-anchor="end">1,00,000.00</text>
	<text x="712" y="396" font-family="Consolas, monospace" font-size="18" fill="#1c2b3a">CGST 9%</text>
	<text x="1088" y="396" font-family="Consolas, monospace" font-size="18" fill="#1c2b3a" text-anchor="end">9,000.00</text>
	<text x="712" y="432" font-family="Consolas, monospace" font-size="18" fill="#1c2b3a">SGST 9%</text>
	<text x="1088" y="432" font-family="Consolas, monospace" font-size="18" fill="#1c2b3a" text-anchor="end">9,000.00</text>

	<line x1="712" y1="452" x2="1088" y2="452" stroke="#1c2b3a" stroke-width="2"/>
	<text x="712" y="492" font-family="Consolas, monospace" font-size="20" font-weight="700" fill="#1c2b3a">Grand total</text>
	<rect x="946" y="470" width="152" height="32" rx="3" fill="#e2efe8"/>
	<text x="1088" y="492" font-family="Consolas, monospace" font-size="20" font-weight="700" fill="#1f6b4e" text-anchor="end">1,29,800.00</text>

	<text x="712" y="524" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-style="italic" fill="#5a6b78">Rupees One Lakh Twenty-Nine Thousand Eight Hundred Only</text>
</svg>`);

await sharp({ create: { width: W, height: H, channels: 4, background: '#eef1f3' } })
	.composite([{ input: svg, top: 0, left: 0 }])
	.png()
	.toFile(outPath);

console.log(`Wrote ${outPath}`);
