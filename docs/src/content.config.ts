import { readFileSync } from 'node:fs';
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { file } from 'astro/loaders';

/** Latest release info, computed from the repo's package.json at build time. */
const repoPkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const version = repoPkg.version;
const artifact = repoPkg.build.nsis.artifactName
  .replace('${version}', version)
  .replace('${ext}', 'exe');
const downloadUrl = `https://github.com/${repoPkg.build.publish[0].owner}/${repoPkg.build.publish[0].repo}/releases/download/v${version}/${artifact}`;

const releaseUrl = `https://github.com/${repoPkg.build.publish[0].owner}/${repoPkg.build.publish[0].repo}/releases`;

const tokens = new Map([
  ['{{DOWNLOAD_URL}}', downloadUrl],
  ['{{RELEASES_URL}}', releaseUrl],
  ['{{VERSION}}', version],
]);

const rewrite = (node) => {
  if (typeof node === 'string') {
    let out = node;
    for (const [token, value] of tokens) out = out.replaceAll(token, value);
    return out;
  }
  if (Array.isArray(node)) return node.map(rewrite);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, rewrite(value)]),
    );
  }
  return node;
};

/**
 * Wraps Starlight's docs loader so frontmatter placeholders — like
 * `{{DOWNLOAD_URL}}` in hero actions — are rewritten with values computed
 * from package.json before the entry is stored.
 */
function tokenDocsLoader() {
  const inner = docsLoader();
  return {
    name: 'token-docs-loader',
    load: (context) =>
      inner.load({
        ...context,
        store: new Proxy(context.store, {
          get(target, prop, receiver) {
            if (prop === 'set') {
              return (entry) => target.set({ ...entry, data: rewrite(entry.data) });
            }
            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }),
      }),
  };
}

const docs = defineCollection({
  loader: tokenDocsLoader(),
  schema: docsSchema(),
});

const i18n = defineCollection({
  loader: file('src/content/i18n/ui.json'),
  schema: i18nSchema(),
});

export const collections = { docs, i18n };

export { version, downloadUrl, releaseUrl };
