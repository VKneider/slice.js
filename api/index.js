// api/index.js - Seguridad automática sin configuración
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { 
  securityMiddleware, 
  sliceFrameworkProtection, 
  suspiciousRequestLogger
} from './middleware/securityMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import sliceConfig from '../src/sliceConfig.json' with { type: 'json' };

let server;
const app = express();

// Parsear argumentos de línea de comandos
const args = process.argv.slice(2);

// Siempre usar development mode (ignorar argumentos de production)
const runMode = 'development';
const folderDeployed = 'src';

// Obtener puerto desde sliceConfig.json, con fallback a process.env.PORT
const PORT = sliceConfig.server?.port || process.env.PORT || 3001;

// ==============================================
// MIDDLEWARES DE SEGURIDAD (APLICAR PRIMERO)
// ==============================================

// 1. Logger de peticiones sospechosas (solo observación, no bloquea)
app.use(suspiciousRequestLogger());

// 2. Protección del framework - TOTALMENTE AUTOMÁTICA
// Detecta automáticamente el dominio desde los headers
// Funciona en localhost, IP, y cualquier dominio
app.use(sliceFrameworkProtection());

// 3. Middleware de seguridad general
app.use(securityMiddleware({
  allowedExtensions: [
    '.js', '.css', '.html', '.json', 
    '.svg', '.png', '.jpg', '.jpeg', '.gif', 
    '.woff', '.woff2', '.ttf', '.ico'
  ],
  blockedPaths: [
    '/node_modules',
    '/package.json',
    '/package-lock.json',
    '/.env',
    '/.git',
    '/api/middleware'
  ],
  allowPublicAssets: true
}));

// ==============================================
// MIDDLEWARES DE APLICACIÓN
// ==============================================

// Middleware para parsear JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar headers de CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// ==============================================
// ARCHIVOS ESTÁTICOS (DESPUÉS DE SEGURIDAD)
// ==============================================

// Servir framework Slice.js
app.use('/Slice/', express.static(path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice')));

// Servir archivos estáticos del proyecto
app.use(express.static(path.join(__dirname, `../${folderDeployed}`)));

// ==============================================
// RUTAS DE API
// ==============================================

// Ruta de ejemplo para API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    mode: runMode,
    folder: folderDeployed,
    timestamp: new Date().toISOString(),
    framework: 'Slice.js',
    version: '2.0.0',
    security: {
      enabled: true,
      mode: 'automatic',
      description: 'Zero-config security - works with any domain'
    }
  });
});

// Ruta para verificar estado de seguridad
app.get('/api/security-status', (req, res) => {
  const host = req.get('Host');
  
  res.json({
    frameworkProtection: {
      status: 'active',
      mode: 'automatic',
      description: 'Allows framework file loading from application, blocks direct browser access',
      detectedHost: host
    },
    blockedPaths: [
      '/node_modules/*',
      '/package.json',
      '/.env',
      '/.git/*'
    ],
    protectedPaths: {
      directAccessBlocked: [
        '/Slice/Components/Structural/*',
        '/Slice/Core/*',
        '/Slice/Services/*'
      ],
      allowedFrom: 'Any request with valid Referer matching current host'
    },
    howItWorks: {
      automatic: true,
      config: 'No configuration needed',
      localhost: 'Works automatically',
      customDomain: 'Works automatically',
      detection: 'Uses Referer and Host headers'
    }
  });
});

// ==============================================
// SPA FALLBACK
// ==============================================

// SPA fallback - servir index.html para rutas no encontradas
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, `../${folderDeployed}`, "App", 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send(`
        <h1>404 - Page Not Found</h1>
        <p>The requested file could not be found in /${folderDeployed}</p>
        <p>Make sure you've run the appropriate build command:</p>
        <ul>
          <li>For development: Files should be in /src</li>
          <li>For production: Run "npm run slice:build" first</li>
        </ul>
      `);
    }
  });
});

// ==============================================
// INICIO DEL SERVIDOR
// ==============================================

function startServer() {
  server = app.listen(PORT, () => {
    console.log(`🔒 Security middleware: active (zero-config, automatic)`);
    console.log(`🚀 Slice.js server running on port ${PORT}`);
  });
}

// Manejar cierre del proceso
process.on('SIGINT', () => {
  console.log('\n🛑 Slice server stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminated');
  process.exit(0);
});

// Iniciar servidor
startServer();

export default app;