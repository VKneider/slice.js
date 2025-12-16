// api/middleware/securityMiddleware.js
import path from 'path';

/**
 * Middleware de seguridad para prevenir acceso directo malicioso
 * pero permitir que la aplicación cargue sus dependencias normalmente
 */
export function securityMiddleware(options = {}) {
  const {
    allowedExtensions = ['.js', '.css', '.html', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', '.ttf'],
    blockedPaths = [
      '/node_modules',
      '/package.json',
      '/package-lock.json',
      '/.env',
      '/.git'
    ],
    allowPublicAssets = true
  } = options;

  return (req, res, next) => {
    const requestPath = req.path;
    
    // 1. Bloquear acceso a rutas definitivamente sensibles (configuración, dependencias)
    const isBlockedPath = blockedPaths.some(blocked => 
      requestPath.startsWith(blocked) || requestPath.includes(blocked)
    );
    
    if (isBlockedPath) {
      console.warn(`🚫 Blocked access to sensitive path: ${requestPath}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access to this resource is not allowed',
        path: requestPath
      });
    }

    // 2. Permitir acceso a assets públicos
    if (allowPublicAssets) {
      const publicPaths = ['/assets', '/public', '/images', '/styles'];
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
      console.warn(`🚫 Blocked file type: ${requestPath}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'File type not allowed',
        extension: fileExtension
      });
    }

    // 4. Prevenir path traversal attacks
    const normalizedPath = path.normalize(requestPath);
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      console.warn(`🚫 Path traversal attempt: ${requestPath}`);
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
    const requestPath = req.path;

    // Rutas del framework que requieren verificación
    const frameworkPaths = [
      '/Slice/Components/Structural',
      '/Slice/Core',
      '/Slice/Services'
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
      console.warn(`🚫 Blocked direct framework file access: ${requestPath}`);
      return res.status(403).json({
        error: 'Framework Protection',
        message: 'Direct access to Slice.js framework files is blocked',
        tip: 'Framework files must be loaded through the application',
        path: requestPath
      });
    }

    // En modo normal (desarrollo), permitir pero advertir
    console.warn(`⚠️  Framework file accessed without valid referer: ${requestPath}`);
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
    const requestPath = req.path;
    
    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(requestPath)
    );

    if (isSuspicious) {
      const clientIp = req.ip || req.connection.remoteAddress;
      console.warn(`⚠️  Suspicious request: ${requestPath} from ${clientIp}`);
    }

    next();
  };
}

/**
 * Middleware para bloquear acceso directo vía navegador (typing en la URL)
 * pero permitir peticiones desde scripts (fetch, import, etc.)
 */
export function directAccessProtection(options = {}) {
  const { protectedPaths = [] } = options;
  
  return (req, res, next) => {
    const requestPath = req.path;
    
    const isProtectedPath = protectedPaths.some(protectedPath => 
      requestPath.startsWith(protectedPath)
    );
    
    if (!isProtectedPath) {
      return next();
    }

    // Detectar acceso directo: 
    // - No tiene Referer (usuario escribió la URL directamente)
    // - Accept header indica navegación HTML
    const referer = req.get('Referer');
    const accept = req.get('Accept') || '';
    
    const isDirectBrowserAccess = !referer && accept.includes('text/html');
    
    if (isDirectBrowserAccess) {
      console.warn(`🚫 Blocked direct browser access: ${requestPath}`);
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Access Denied</title>
          <style>
            body { 
              font-family: system-ui; 
              max-width: 600px; 
              margin: 100px auto; 
              padding: 20px;
            }
            h1 { color: #d32f2f; }
            code { 
              background: #f5f5f5; 
              padding: 2px 6px; 
              border-radius: 3px;
            }
          </style>
        </head>
        <body>
          <h1>🚫 Direct Access Denied</h1>
          <p>This file cannot be accessed directly.</p>
          <p>Path: <code>${requestPath}</code></p>
          <p>Framework files are automatically loaded by the application.</p>
          <p><a href="/">← Return to application</a></p>
        </body>
        </html>
      `);
    }

    next();
  };
}

export default {
  securityMiddleware,
  sliceFrameworkProtection,
  suspiciousRequestLogger,
  directAccessProtection
};