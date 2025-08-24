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

// Detectar configuración automáticamente
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_CLI_MODE = process.env.SLICE_CLI_MODE === 'true';

// Determinar directorio a servir
// Prioridad: 1) NODE_ENV del CLI, 2) sliceConfig.production, 3) default 'src'
let folderDeployed;
if (NODE_ENV === 'production') {
  folderDeployed = 'dist';
} else if (NODE_ENV === 'development') {
  folderDeployed = 'src';
} else {
  // Fallback al comportamiento original
  const isProduction = sliceConfig.production === true;
  folderDeployed = isProduction ? 'dist' : 'src';
}

// Servir archivos estáticos desde la carpeta 'Slice'
app.use('/Slice/', express.static(path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice')));

// Testing routes (mantener las existentes)
app.get('/testing1', (req, res) => {
   res.send(` Actual route in server: __dirname: ${__dirname} __filename: ${__filename} - checking if file exists: ${path.join(__dirname, '..', 'src','App', 'index.html')}`);
});

// Servir archivos estáticos desde la carpeta determinada (src o dist)
app.use(express.static(path.join(__dirname,'..', folderDeployed)));

app.get('/testing2', (req, res) => {
   res.send(` Actual route in server: __dirname: ${__dirname} __filename: ${__filename} - checking if file exists: ${path.join(__dirname, '..', 'src','App', 'index.html')}`);
});

// API de estado (útil para debugging)
app.get('/api/status', (req, res) => {
  res.json({ 
    mode: NODE_ENV,
    serving: folderDeployed,
    port: PORT,
    cliMode: IS_CLI_MODE,
    timestamp: new Date().toISOString()
  });
});

// Ruta para servir el index.html desde la carpeta apropiada
app.get('*', (req, res) => {
   const filePath = path.join(__dirname, '..', folderDeployed, 'App', 'index.html');
   res.sendFile(filePath, (err) => {
     if (err) {
       // Fallback si no existe App/index.html
       const fallbackPath = path.join(__dirname, '..', folderDeployed, 'index.html');
       res.sendFile(fallbackPath, (fallbackErr) => {
         if (fallbackErr) {
           res.status(404).send(`File not found: ${folderDeployed}/index.html`);
         }
       });
     }
   });
});

function startServer() {
   server = app.listen(PORT, () => {    
      if (IS_CLI_MODE) {
        // Modo CLI - salida simple y limpia (sin menú)
        console.log(`🚀 Slice.js ${NODE_ENV} server running at http://localhost:${PORT}`);
        console.log(`📁 Serving files from /${folderDeployed} directory`);
        console.log('Press Ctrl+C to stop the server');
      } else {
        // Modo standalone - mostrar menú interactivo
        showMenu();
      }
   });
}

async function showMenu() {
   console.clear();
   console.log("\n=================================");
   console.log("       SLICE SERVER MENU       ");
   console.log("=================================\n");

   const url = `http://localhost:${PORT}`;
   console.log(`Server is running on port ${PORT}, ${url}`);
   console.log(`Mode: ${NODE_ENV} | Serving: /${folderDeployed}\n`);

   while (true) {
      try {
        const { action } = await inquirer.prompt([
           {
              type: 'list',
              name: 'action',
              message: 'Select an option:',
              choices: ['Restart Server', 'Stop Server (Exit)']
           }
        ]);
        
        if (action === 'Stop Server (Exit)') {
           console.log('\nShutting down server...');
           server.close(() => {
              console.log('Server stopped.');
              process.exit(0);
           });
           break;
        } else if (action === 'Restart Server') {
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
  if (IS_CLI_MODE) {
    console.log('\n🛑 Server stopped');
  } else {
    console.log('\n🛑 Slice server stopped');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminated');
  process.exit(0);
});

// Iniciar servidor
startServer();

export default app;