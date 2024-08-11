import express from 'express';
import path from 'path';
import ServerlessHttp from 'serverless-http';


const app = express();
const PORT = 3000;


// Servir archivos estáticos desde la carpeta 'Slice'
app.use('/Slice/', express.static(path.join(__dirname, '..','..', 'Slice')));
// Servir archivos estáticos desde la carpeta 'App'
app.use(express.static(path.join(__dirname, '..', '..', 'src')));

app.get('/test', (req, res) => {
   res.send(
      `${__dirname} , ruta static: ${path.join(__dirname, '..', 'src')} y la ruta final para el index.html: ${path.join(__dirname, '..', 'src', 'App', 'index.html')}`
   );
});


// Ruta para servir el index.html desde la carpeta 'App'
app.get('*', (req, res) => {
   console.log('requesting index.html', req.url);
   const filePath = path.join(__dirname, '..','..', 'src', 'App', 'index.html');
   res.sendFile(filePath);
});

app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}, http://localhost:${PORT}`);
});

const handler = ServerlessHttp(app);

module.exports.handler = async (event, context) => {
   const result = await handler(event, context);
   return result;
} 