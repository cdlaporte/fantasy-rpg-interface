// Zero-dependency static server for the repo root.
// Usage: node tools/serve.mjs [port]   (default 8080; port 0 picks a free port)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.argv[2] !== undefined ? Number(process.argv[2]) : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400, NO_CACHE);
    res.end('Bad request');
    return;
  }
  let file = path.normalize(path.join(ROOT, urlPath));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403, NO_CACHE);
    res.end('Forbidden');
    return;
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!urlPath.endsWith('/')) {
        res.writeHead(301, { ...NO_CACHE, Location: urlPath + '/' });
        res.end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    fs.readFile(file, (err2, buf) => {
      if (err2) {
        res.writeHead(404, { ...NO_CACHE, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found: ' + urlPath);
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { ...NO_CACHE, 'Content-Type': type, 'Content-Length': buf.length });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = server.address();
  console.log(`Serving ${ROOT} at http://127.0.0.1:${addr.port}/`);
});
