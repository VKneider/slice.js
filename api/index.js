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
const PORT = 3001;

const isProduction = sliceConfig.production === true;
const folderDeployed = isProduction ? 'dist' : 'src';

// Servir archivos estáticos desde la carpeta 'Slice'
app.use('/Slice/', express.static(path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice')));
// Servir archivos estáticos desde la carpeta 'App'





app.get('/testing1', (req, res) => {
   res.send(` Actual route in server: __dirname: ${__dirname} __filename: ${__filename} - checking if file exists: ${path.join(__dirname, '..', 'src','App', 'index.html')}`);
});


app.use(express.static(path.join(__dirname,'..', folderDeployed)));


app.get('/testing2', (req, res) => {
   res.send(` Actual route in server: __dirname: ${__dirname} __filename: ${__filename} - checking if file exists: ${path.join(__dirname, '..', 'src','App', 'index.html')}`);
});

if(isProduction){
   
}


// Ruta para servir el index.html desde la carpeta 'App'
app.get('*', (req, res) => {
   const filePath = path.join(__dirname, '..', 'src','App', 'index.html');
   res.sendFile(filePath);
});

function startServer() {
   server = app.listen(PORT, () => {    
      showMenu();
   });
}

async function showMenu() {

   console.clear();
   console.log("\n=================================");
   console.log("       SLICE SERVER MENU       ");
   console.log("=================================\n");

   const url = `http://localhost:${PORT}`;
      console.log(`Server is running on port ${PORT}, ${url}\n`);

   while (true) {
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
   }
}

startServer();


export default app;


