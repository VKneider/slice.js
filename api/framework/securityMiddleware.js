// api/framework/securityMiddleware.js
import path from 'path';

/**
 * Express exposes `req.path` still percent-encoded, but `express.static` (via
 * `send`) decodes it before touching the filesystem. A request for `/%2eenv`
 * therefore bypassed every check written against the raw path and could serve a
 * `.env` that sat in `public/`. Decode once (and tolerate double encoding) so
 * the guards inspect the same path the file server will resolve.
 */
export function decodeRequestPath(value) {
  let decoded = String(value || '');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      break;
    }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded.replace(/\\/g, '/');
}

// Security events are intentionally quiet: `slice dev` should not narrate every
// probe or every framework module fetched without a referer. Requests are still
// blocked exactly as before; set SLICE_DEBUG=1 to see the reason. Even then each
// category is logged at most once a minute, so a scanner cannot flood the terminal.
const WARNING_COOLDOWN_MS = 60_000;
const lastWarningAt = new Map();

function isDebug() {
  return process.env.SLICE_DEBUG === '1' || process.env.SLICE_DEBUG === 'true';
}

function report(category, message, { always = false } = {}) {
  if (!always && !isDebug()) return;

  const now = Date.now();
  if (now - (lastWarningAt.get(category) || 0) < WARNING_COOLDOWN_MS) return;
  lastWarningAt.set(category, now);

  console.warn(`[slice:security] ${message}`);
}

/**
 * Middleware de seguridad para prevenir acceso directo malicioso
 * pero permitir que la aplicación cargue sus dependencias normalmente
 */
export function securityMiddleware(options = {}) {
  const {
    allowedExtensions = [
      '.js', '.mjs', '.cjs',
      '.css',
      '.html', '.htm',
      '.json',
      '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
      '.woff', '.woff2', '.ttf', '.otf', '.eot',
      '.txt', '.xml', '.pdf',
      '.webm', '.mp4', '.mp3', '.wav', '.ogg',
      '.wasm'
    ],
    blockedPaths = [
      '/node_modules',
      '/package.json',
      '/package-lock.json',
      '/.env',
      '/.git'
    ],
    allowPublicAssets = true,
    publicPaths = ['/assets', '/public', '/images', '/styles']
  } = options;

  return (req, res, next) => {
    const requestPath = decodeRequestPath(req.path);

    // 1. Bloquear acceso a rutas definitivamente sensibles (configuración, dependencias)
    const isBlockedPath = blockedPaths.some(blocked =>
      requestPath.startsWith(blocked) || requestPath.includes(blocked)
    );

    if (isBlockedPath) {
      report('blocked-path', `Blocked access to sensitive path: ${requestPath}`, { always: true });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access to this resource is not allowed',
        path: requestPath
      });
    }

    // 2. Permitir acceso a assets públicos (servidos desde src/public/)
    if (allowPublicAssets) {
      const isPublicAsset = publicPaths.some(publicPath =>
        requestPath.startsWith(publicPath)
      );

      if (isPublicAsset) {
        return next();
      }
    }

    // 3. Validar extensiones de archivo
    const fileExtension = path.extname(requestPath).toLowerCase();

    if (fileExtension && !allowedExtensions.includes(fileExtension)) {
      report('blocked-extension', `Blocked file type: ${requestPath}`, { always: true });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'File type not allowed',
        extension: fileExtension
      });
    }

    // 4. Prevenir path traversal attacks
    const normalizedPath = path.normalize(requestPath);
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      report('path-traversal', `Path traversal attempt: ${requestPath}`, { always: true });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid path',
        path: requestPath
      });
    }

    // Todo está bien, continuar
    next();
  };
}

/**
 * Middleware específico para proteger archivos del framework Slice.js
 * PERMITE acceso cuando viene desde la propia aplicación (Referer válido)
 * BLOQUEA acceso directo desde navegador o herramientas externas
 */
export function sliceFrameworkProtection(options = {}) {
  const {
    port = 3000,
    strictMode = false,
    allowedDomains = [] // Dominios personalizados permitidos
  } = options;

  return (req, res, next) => {
    const requestPath = decodeRequestPath(req.path);

    // Rutas del framework que requieren verificación
    const frameworkPaths = [
      '/Slice/Components/Structural'
    ];

    const isFrameworkFile = frameworkPaths.some(fwPath =>
      requestPath.startsWith(fwPath)
    );

    if (!isFrameworkFile) {
      return next();
    }

    // Verificar el origen de la petición
    const referer = req.get('Referer') || req.get('Referrer');
    const origin = req.get('Origin');
    const host = req.get('Host');

    // Construir lista de orígenes válidos dinámicamente
    const validOrigins = [
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
      `http://0.0.0.0:${port}`,
      `https://localhost:${port}`,
      ...allowedDomains // Dominios personalizados del usuario
    ];

    // Si hay un Host header, agregarlo automáticamente
    if (host) {
      validOrigins.push(`http://${host}`);
      validOrigins.push(`https://${host}`);
    }

    // Verificar si la petición viene de un origen válido
    const hasValidReferer = referer && validOrigins.some(valid => referer.startsWith(valid));
    const hasValidOrigin = origin && validOrigins.some(valid => origin === valid);
    const isSameHost = host && referer && referer.includes(host);

    // Permitir si viene desde la aplicación
    if (hasValidReferer || hasValidOrigin || isSameHost) {
      return next();
    }

    // En modo estricto, bloquear todo acceso sin referer válido
    if (strictMode) {
      report('blocked-framework', `Blocked direct framework file access: ${requestPath}`, { always: true });
      return res.status(403).json({
        error: 'Framework Protection',
        message: 'Direct access to Slice.js framework files is blocked',
        tip: 'Framework files must be loaded through the application',
        path: requestPath
      });
    }

    // En modo normal (desarrollo), permitir. A direct hit on a framework module
    // is common while debugging, so it is only reported with SLICE_DEBUG=1.
    report('framework-referer', `Framework file accessed without a valid referer: ${requestPath}`);
    next();
  };
}

/**
 * Middleware para logging de peticiones sospechosas
 */
export function suspiciousRequestLogger() {
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /~/, // Home directory access
    /\.env/, // Environment files
    /\.git/, // Git files
    /package\.json/, // Package files
    /package-lock\.json/,
    /node_modules/, // Dependencies
  ];

  return (req, res, next) => {
    const requestPath = decodeRequestPath(req.path);

    const isSuspicious = suspiciousPatterns.some(pattern =>
      pattern.test(requestPath)
    );

    if (isSuspicious) {
      const clientIp = req.ip || req.connection.remoteAddress;
      report('suspicious', `Suspicious request: ${requestPath} from ${clientIp}`);
    }

    next();
  };
}

export default {
  securityMiddleware,
  sliceFrameworkProtection,
  suspiciousRequestLogger
};
