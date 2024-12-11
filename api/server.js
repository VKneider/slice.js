import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Servir archivos estáticos desde la carpeta 'Slice'
app.use('/Slice/', express.static(path.join(__dirname,'..','Slice')));
// Servir archivos estáticos desde la carpeta 'App'

app.get('/testing1', (req, res) => {
   res.send(` Actual route in server: __dirname: ${__dirname} __filename: ${__filename} - checking if file exists: ${path.join(__dirname, '..', 'src','App', 'index.html')}`);
});

app.use(express.static(path.join(__dirname,'..', 'src')));


app.get('/testing2', (req, res) => {
   res.send(` Actual route in server: __dirname: ${__dirname} __filename: ${__filename} - checking if file exists: ${path.join(__dirname, '..', 'src','App', 'index.html')}`);
});

app

// Ruta para servir el index.html desde la carpeta 'App'
app.get('*', (req, res) => {
   console.log('requesting index.html', req.url);
   console.log(req.url)
   console.log(__dirname)
   const filePath = path.join(__dirname, '..', 'src','App', 'index.html');
   res.sendFile(filePath);
});

app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}, http://localhost:${PORT}`);
});

export default app;


