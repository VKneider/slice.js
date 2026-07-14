// api/framework/precompressedStatic.js
//
// Serves a precompressed `.br`/`.gz` sibling (produced by `slice build --compress`)
// when the client accepts that encoding and the file exists, instead of
// compressing on every request. Falls through to the normal static handlers
// when there is no precompressed variant or the client doesn't accept one.
//
// Mounted before the runtime `compression` middleware short-circuits it: the
// response ends here with Content-Encoding already set, so compression never
// re-compresses an already-encoded body.

import fs from 'node:fs';
import path from 'node:path';

const ENCODING_EXTENSION = { br: '.br', gzip: '.gz' };

// Only known text types are served pre-encoded; the Content-Type is taken from
// the ORIGINAL extension (the browser must not see `.br` as the type).
const CONTENT_TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

/** Encodings the client accepts, most-preferred first (brotli over gzip). */
function preferredEncodings(acceptEncoding) {
  const accepts = String(acceptEncoding || '').toLowerCase();
  const list = [];
  if (accepts.includes('br')) list.push('br');
  if (accepts.includes('gzip')) list.push('gzip');
  return list;
}

/**
 * @param {string[]} roots Absolute directories to resolve `req.path` against,
 *   in priority order (e.g. [dist/public, dist]).
 * @returns {import('express').RequestHandler}
 */
export function createPrecompressedStatic(roots = []) {
  const resolvedRoots = roots.filter(Boolean).map((r) => path.resolve(r));

  return function precompressedStatic(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const encodings = preferredEncodings(req.headers['accept-encoding']);
    if (encodings.length === 0) return next();

    let rel;
    try {
      rel = decodeURIComponent(req.path).replace(/^\/+/, '');
    } catch {
      return next();
    }
    if (!rel || rel.includes('\0')) return next();

    const ext = path.extname(rel).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) return next();

    for (const root of resolvedRoots) {
      const target = path.normalize(path.join(root, rel));
      // Path traversal guard: the resolved file must stay under the root.
      if (target !== root && !target.startsWith(root + path.sep)) continue;

      for (const enc of encodings) {
        const encodedPath = target + ENCODING_EXTENSION[enc];
        try {
          if (fs.existsSync(encodedPath) && fs.statSync(encodedPath).isFile()) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Encoding', enc);
            res.setHeader('Vary', 'Accept-Encoding');
            return res.send(fs.readFileSync(encodedPath));
          }
        } catch {
          // Unreadable candidate — try the next encoding/root.
        }
      }
    }

    return next();
  };
}

export default createPrecompressedStatic;
