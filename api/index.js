// api/index.js — server entrypoint.
//
// Everything you add goes between createSliceServer() and start(): ordinary
// Express middleware, an /api router, auth, request logging. start() mounts the
// terminal fallback (the only middleware that must be last) and then listens.
//
//   const { app, start } = createSliceServer();
//   app.use('/api/hooks', hooks);
//   start();
import { createSliceServer } from 'slicejs-web-framework/api/framework/server.js';

const { app, start } = createSliceServer();

start();

export default app;
