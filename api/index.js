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
let runMode = 'development'; // Default

// Detectar modo basado en argumentos
if (args.includes('--production') || args.includes('--prod')) {
  runMode = 'production';
} else if (args.includes('--development') || args.includes('--dev')) {
  runMode = 'development';
}

// También mantener compatibilidad con NODE_ENV como fallback
if (!args.length) {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  runMode = NODE_ENV === 'production' ? 'production' : 'development';
}

// Obtener puerto desde sliceConfig.json, con fallback a process.env.PORT
const PORT = sliceConfig.server?.port || process.env.PORT || 3001;

// Determinar directorio a servir basado en argumentos
let folderDeployed;
if (runMode === 'production') {
  folderDeployed = 'dist';
} else {
  folderDeployed = 'src';
}

console.log(`🚀 Starting Slice.js server in ${runMode} mode`);
console.log(`📁 Serving files from: /${folderDeployed}`);

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
  const indexPath = path.join(__dirname, `../${folderDeployed}`, 'index.html');
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
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📂 Mode: ${runMode} (serving from /${folderDeployed})`);
    
    if (runMode === 'development') {
      console.log('🔄 Development mode: Changes in /src will require server restart');
    } else {
      console.log('⚡ Production mode: Serving optimized files from /dist');
    }
    
    console.log('🛑 Press Ctrl+C to stop');
    console.log('\n💡 Available commands:');
    console.log('  - Development: npm run slice:dev');
    console.log('  - Production:  npm run slice:start');
    console.log('  - Build:       npm run slice:build');
  });

  // Siempre mostrar menú interactivo
  setTimeout(showInteractiveMenu, 1000);
}

async function showInteractiveMenu() {
  while (true) {
    try {
      console.log('\n' + '='.repeat(50));
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '🎛️  Server Control Menu',
          choices: [
            '📊 Server Status',
            '🌐 Open in Browser',
            '🔄 Restart Server',
            '🛑 Stop Server'
          ]
        }
      ]);

      if (action === '📊 Server Status') {
        console.log(`\n📈 Server Status:`);
        console.log(`   🔗 URL: http://localhost:${PORT}`);
        console.log(`   📁 Mode: ${runMode}`);
        console.log(`   📂 Serving: /${folderDeployed}`);
        console.log(`   ⏰ Uptime: ${Math.floor(process.uptime())}s`);
      } else if (action === '🌐 Open in Browser') {
        const { default: open } = await import('open');
        await open(`http://localhost:${PORT}`);
        console.log('🌐 Opening browser...');
      } else if (action === '🛑 Stop Server') {
        console.log('\n🛑 Stopping server...');
        server.close(() => {
          console.log('✅ Server stopped successfully');
          process.exit(0);
        });
        break;
      } else if (action === '🔄 Restart Server') {
        console.log('\nRestarting server...');
        server.close(() => {
          console.log('Server stopped. Restarting...');
          startServer();
        });
        break;
      }
    } catch (error) {
      // Si hay error con inquirer, continuar sin menú
      console.log('\n💡 Interactive menu not available - Press Ctrl+C to stop');
      break;
    }
  }
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