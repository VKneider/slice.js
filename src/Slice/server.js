import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, '..', '..', 'src')));

console.log(`__dirname: ${__dirname}`);
console.log(`path.join(__dirname, '..', '..','src'): ${path.join(__dirname, '..', '..','src')}`);

app.get('*', (req, res) => {
   console.log(`Requested URL: ${req.url}`)
   const filePath = path.join(__dirname, '..', 'App', 'index.html');
   res.sendFile(filePath);
});



app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}, http://localhost:${PORT}`);
});

export default app;
