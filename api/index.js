// api/index.js - Punto de entrada del servidor
import { createSliceServer } from 'slicejs-web-framework/api/framework/server.js';

const server = createSliceServer();
server.start();

export default server.app;
