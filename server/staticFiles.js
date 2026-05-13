import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { publicDir } from './config.js';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export const serveStatic = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = requestedPath === '/'
    ? join(publicDir, 'index.html')
    : resolve(publicDir, `.${requestedPath}`);

  const publicRelativePath = relative(publicDir, filePath);
  const isInsidePublicDir = publicRelativePath
    && !publicRelativePath.startsWith('..')
    && !isAbsolute(publicRelativePath);
  const safePath = isInsidePublicDir ? filePath : join(publicDir, 'index.html');
  const finalPath = existsSync(safePath) && !safePath.endsWith('\\')
    ? safePath
    : join(publicDir, 'index.html');

  if (!existsSync(finalPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build introuvable. Lance npm run build avant npm start.');
    return;
  }

  res.writeHead(200, {
    'Content-Type': mimeTypes[extname(finalPath)] || 'application/octet-stream',
  });
  res.end(readFileSync(finalPath));
};
