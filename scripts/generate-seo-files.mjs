import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const DEFAULT_SITE_URL = 'https://escape-game-builder.netlify.app';
const rawSiteUrl = process.env.VITE_SITE_URL || process.env.URL || process.env.DEPLOY_URL || DEFAULT_SITE_URL;
const siteUrl = rawSiteUrl.replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

const absoluteUrl = (path = '/') => {
  if (!siteUrl) return path;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const sitemapEntries = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: '1.0',
  },
  {
    path: '/?gallery=1',
    changefreq: 'daily',
    priority: '0.8',
  },
  {
    path: '/conditions-utilisation.html',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/politique-confidentialite.html',
    changefreq: 'yearly',
    priority: '0.3',
  },
];

const sitemapUrls = sitemapEntries.map((entry) => `  <url>
    <loc>${escapeXml(absoluteUrl(entry.path))}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${absoluteUrl('/sitemap.xml')}
`;

await mkdir(distDir, { recursive: true });
await writeFile(resolve(distDir, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(resolve(distDir, 'robots.txt'), robots, 'utf8');

if (siteUrl) {
  const indexPath = resolve(distDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  await writeFile(
    indexPath,
    indexHtml
      .replaceAll(DEFAULT_SITE_URL, siteUrl)
      .replace(/<link\s+rel="canonical"\s+href="\/"\s+data-seo-canonical\s*\/?>/, `<link rel="canonical" href="${absoluteUrl('/')}" data-seo-canonical />`)
      .replace(/<meta\s+property="og:url"\s+content="\/"\s+data-seo-og-url\s*\/?>/, `<meta property="og:url" content="${absoluteUrl('/')}" data-seo-og-url />`)
      .replaceAll('content="/og-image.png"', `content="${absoluteUrl('/og-image.png')}"`),
    'utf8',
  );
}
