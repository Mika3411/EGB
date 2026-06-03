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

export const STATIC_SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ].join('; '),
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'bluetooth=()',
    'camera=()',
    'clipboard-write=(self)',
    'display-capture=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'serial=()',
    'usb=()',
    'xr-spatial-tracking=()',
  ].join(', '),
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
    res.writeHead(404, {
      ...STATIC_SECURITY_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Build introuvable. Lance npm run build avant npm start.');
    return;
  }

  res.writeHead(200, {
    ...STATIC_SECURITY_HEADERS,
    'Content-Type': mimeTypes[extname(finalPath)] || 'application/octet-stream',
  });
  res.end(readFileSync(finalPath));
};
