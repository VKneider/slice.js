import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Servir archivos estáticos desde la carpeta 'Slice'
app.use('/Slice/', (req, res, next) => {
   console.log(`Middleware '/Slice' ejecutado. Ruta solicitada: ${req.url}`);
   next();
});
/*
app.use((req, res, next) => {
   console.log(`Middleware base ejecutado. Ruta solicitada: ${req.url}`);
   next();
});
*/
app.use(express.static(path.join(__dirname, '..', '..','src')));

// Ruta para servir el index.html desde la carpeta 'App'
app.get('*', (req, res) => {
   console.log(`Requested URL: ${req.url}`)
   const filePath = path.join(__dirname, '..', 'App', 'index.html');
   res.sendFile(filePath);
});

app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}, http://localhost:${PORT}`);
});

export default app;
