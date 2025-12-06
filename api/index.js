import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import inquirer from 'inquirer';

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


app.use('/Slice/', express.static(path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice')));


// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, `../${folderDeployed}`)));

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

// Ruta de ejemplo para API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    mode: runMode,
    folder: folderDeployed,
    timestamp: new Date().toISOString(),
    framework: 'Slice.js',
    version: '2.0.0'
  });
});

// SPA fallback - servir index.html para rutas no encontradas
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, `../${folderDeployed}`,"App", 'index.html');
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

function startServer() {
  server = app.listen(PORT, () => {
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
