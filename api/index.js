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

// Función de utilidad para verificar si existe el directorio bundles
function bundlesDirectoryExists() {
  const bundleDir = path.join(__dirname, `../${folderDeployed}`, 'bundles');
  return fs.existsSync(bundleDir) && fs.statSync(bundleDir).isDirectory();
}

// Capturar todas las peticiones a bundles para debugging
app.use('/bundles/', (req, res, next) => {
  console.log(`🔍 Bundle request: ${req.method} ${req.originalUrl}`);
  next();
});

// Middleware personalizado para archivos de bundles con MIME types correctos
// ⚠️ DEBE IR ANTES del middleware general para tener prioridad
app.use('/bundles/', (req, res, next) => {
  // Verificar si existe el directorio bundles
  if (!bundlesDirectoryExists()) {
    console.log(`ℹ️ Bundles directory does not exist, skipping bundle processing`);
    return next(); // Continuar con el siguiente middleware
  }

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
      // Listar archivos disponibles para debugging
      try {
        const bundleDir = path.join(__dirname, `../${folderDeployed}`, 'bundles');
        if (fs.existsSync(bundleDir)) {
          const files = fs.readdirSync(bundleDir);
          console.log(`📁 Available files in bundles: ${files.join(', ')}`);
        }
      } catch (e) {
        console.log(`❌ Could not list bundle directory: ${e.message}`);
      }
      return res.status(404).send('Bundle file not found');
    }
  }

  // Para archivos no .js, continuar con el middleware estático normal
  next();
});

// Servir otros archivos de bundles (CSS, etc.) con el middleware estático normal
// Solo si existe el directorio bundles
if (bundlesDirectoryExists()) {
  app.use('/bundles/', express.static(path.join(__dirname, `../${folderDeployed}`, 'bundles')));
  console.log(`📦 Bundles directory found, serving static files`);
} else {
  console.log(`ℹ️ Bundles directory not found, skipping static bundle serving`);
}

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