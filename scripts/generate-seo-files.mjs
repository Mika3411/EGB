import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const siteUrl = (process.env.VITE_SITE_URL || process.env.URL || process.env.DEPLOY_URL || '').replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

const absoluteUrl = (path = '/') => {
  if (!siteUrl) return path;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const sitemapLocation = siteUrl ? absoluteUrl('/') : '/';
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${sitemapLocation}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
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
      .replace(/<link\s+rel="canonical"\s+href="\/"\s+data-seo-canonical\s*\/?>/, `<link rel="canonical" href="${absoluteUrl('/')}" data-seo-canonical />`)
      .replace(/<meta\s+property="og:url"\s+content="\/"\s+data-seo-og-url\s*\/?>/, `<meta property="og:url" content="${absoluteUrl('/')}" data-seo-og-url />`)
      .replace('<meta property="og:image" content="/og-image.png" />', `<meta property="og:image" content="${absoluteUrl('/og-image.png')}" />`)
      .replace('<meta name="twitter:image" content="/og-image.png" />', `<meta name="twitter:image" content="${absoluteUrl('/og-image.png')}" />`),
    'utf8',
  );
}
