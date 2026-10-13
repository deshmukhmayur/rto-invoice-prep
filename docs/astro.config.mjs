import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const BASE = '/rto-invoice-prep/';

export default defineConfig({
  publicDir: './src/public',
  base: BASE,
  site: 'https://deshmukhmayur.github.io',
  trailingSlash: 'ignore',
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
      sidebar: [
        {
          label: 'Getting started',
          slug: 'getting-started',
          translations: {
            hi: 'शुरुआत',
            mr: 'सुरुवात',
          },
        },
        {
          label: 'User guide',
          slug: 'guide',
          translations: {
            hi: 'उपयोग गाइड',
            mr: 'वापर मार्गदर्शक',
          },
        },
        {
          label: 'FAQ',
          slug: 'faq',
          translations: {
            hi: 'सामान्य प्रश्न',
            mr: 'सामान्य प्रश्ने',
          },
        },
      ],
      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/deshmukhmayur/rto-invoice-prep',
        },
      ],
      pagefind: false,
      components: { Footer: './src/components/Footer.astro' },
    }),
  ],
});
