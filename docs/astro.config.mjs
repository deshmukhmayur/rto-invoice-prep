import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const BASE = '/rto-invoice-prep/';

/** Add target="_blank" + rel to links that leave the site. No deps. */
const externalLinks = () => (tree) => {
	const walk = (node) => {
		if (node.tagName === 'a') {
			const href = node.properties?.href;
			if (typeof href === 'string' && /^https?:\/\//.test(href) && !href.startsWith('mailto:')) {
				node.properties.target = '_blank';
				node.properties.rel = 'noopener noreferrer';
			}
		}
		for (const child of node.children ?? []) walk(child);
	};
	walk(tree);
};

export default defineConfig({
	publicDir: './src/public',
	base: BASE,
	site: 'https://deshmukhmayur.github.io',
	trailingSlash: 'ignore',
	markdown: {
		rehypePlugins: [externalLinks],
	},
	integrations: [
		starlight({
			title: 'RTO Invoice Prep',
			description:
				'Prepare dealership invoices for RTO registration. Remove the discount line from OEM tax invoices — right in the PDF.',
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				hi: { label: 'हिन्दी', lang: 'hi' },
				mr: { label: 'मराठी', lang: 'mr' },
			},
			social: [
				{
					label: 'GitHub',
					icon: 'github',
					href: 'https://github.com/deshmukhmayur/rto-invoice-prep',
				},
			],
			// Not rendered anywhere (all pages use the splash template), but it
			// drives the prev/next order at the bottom of doc pages. Without it,
			// Starlight autogenerates an alphabetical sidebar across every locale.
			sidebar: [
				{ slug: 'getting-started' },
				{ slug: 'guide' },
				{ slug: 'faq' },
			],
			logo: { src: './src/public/icon.png', alt: 'RTO Invoice Prep' },
			favicon: '/icon.png',
			pagefind: false,
			customCss: ['./src/custom.css'],
			components: {
				Head: './src/components/CustomHead.astro',
				Footer: './src/components/Footer.astro',
				Hero: './src/components/HeroInvoice.astro',
				Header: './src/components/SiteHeader.astro',
				ThemeSelect: './src/components/ThemeToggle.astro',
			},
		}),
	],
});
