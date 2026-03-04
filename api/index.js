// api/index.js - Seguridad automática sin configuración
import express from 'express';
import path from 'path';
import fs from 'fs';
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

const runMode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const folderDeployed = runMode === 'production' ? 'dist' : 'src';

// Obtener puerto desde process.env.PORT con fallback a sliceConfig.json
const PORT = process.env.PORT || sliceConfig.server?.port || 3001;

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

// Middleware global para archivos JavaScript con MIME types correctos
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    // Forzar headers correctos para TODOS los archivos .js
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  next();
});

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

if (runMode === 'production') {
  app.get('/Slice/Slice.js', (req, res) => {
    const slicePath = path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice', 'Slice.js');
    if (fs.existsSync(slicePath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(fs.readFileSync(slicePath, 'utf8'));
    }
    return res.status(404).send('Slice.js not found');
  });

  app.use('/Slice', (req, res) => res.status(404).send('Not found'));
  app.use('/Components', (req, res) => res.status(404).send('Not found'));
}

// Middleware personalizado para archivos de bundles con MIME types correctos
// ⚠️ DEBE IR ANTES del middleware general para tener prioridad
app.use('/bundles/', (req, res, next) => {
  // Solo procesar archivos .js
  if (req.path.endsWith('.js')) {
    const filePath = path.join(__dirname, `../${folderDeployed}`, 'bundles', req.path);
    console.log(`📂 Processing bundle: ${req.path} -> ${filePath}`);

    // Verificar que el archivo existe
    if (fs.existsSync(filePath)) {
      try {
        // Leer y servir el archivo con headers correctos
        const fileContent = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // No cachear para permitir actualizaciones en tiempo real
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        console.log(`✅ Serving bundle: ${req.path} (${fileContent.length} bytes, ${Buffer.byteLength(fileContent, 'utf8')} bytes UTF-8)`);
        return res.send(fileContent);
      } catch (error) {
        console.log(`❌ Error reading bundle file: ${error.message}`);
        return res.status(500).send('Error reading bundle file');
      }
    } else {
      console.log(`❌ Bundle file not found: ${filePath}`);
      return res.status(404).send('Bundle file not found');
    }
  }

  // Para archivos no .js, continuar con el middleware estático normal
  next();
});

// Servir otros archivos de bundles (JSON, CSS, etc.) con el middleware estático normal
app.use('/bundles/', express.static(path.join(__dirname, `../${folderDeployed}`, 'bundles')));
console.log(`📦 Serving bundles from /${folderDeployed}/bundles`);

// Servir framework Slice.js (solo development)
if (runMode === 'development') {
  app.use('/Slice/', express.static(path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice')));
}

// Servir archivos estáticos del proyecto con allowlist
const publicFolders = Array.isArray(sliceConfig.publicFolders) ? sliceConfig.publicFolders : [];
const normalizedPublicFolders = publicFolders
  .filter((entry) => typeof entry === 'string')
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0)
  .map((entry) => (entry.startsWith('/') ? entry : `/${entry}`));

if (runMode === 'development') {
  app.use(express.static(path.join(__dirname, `../${folderDeployed}`)));
} else {
  app.use('/App', express.static(path.join(__dirname, `../${folderDeployed}`, 'App')));
  app.get('/manifest.json', (req, res) => {
    const manifestPath = path.join(__dirname, `../${folderDeployed}`, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(fs.readFileSync(manifestPath, 'utf8'));
    }
    return res.status(404).send('manifest.json not found');
  });
  app.get('/service-worker.js', (req, res) => {
    const workerPath = path.join(__dirname, `../${folderDeployed}`, 'service-worker.js');
    if (fs.existsSync(workerPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(fs.readFileSync(workerPath, 'utf8'));
    }
    return res.status(404).send('service-worker.js not found');
  });
  app.get('/routes.js', (req, res) => {
    const routesPath = path.join(__dirname, `../${folderDeployed}`, 'routes.js');
    if (fs.existsSync(routesPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(fs.readFileSync(routesPath, 'utf8'));
    }
    return res.status(404).send('routes.js not found');
  });
  for (const folder of normalizedPublicFolders) {
    app.use(folder, express.static(path.join(__dirname, `../${folderDeployed}`, folder)));
  }
  app.use('/bundles/', express.static(path.join(__dirname, `../${folderDeployed}`, 'bundles')));
  app.use('/dist/', express.static(path.join(__dirname, '..', 'dist')));
}

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
