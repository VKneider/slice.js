# Server & Framework Backlog

Mejoras identificadas para el servidor Express del framework (`api/index.js` y `api/middleware/`).

---

## 1. SPA fallback no debe atrapar rutas `/api/*` ✅

**Implementado:** Antes del SPA fallback se agregó `app.use('/api', ...)` que responde con JSON 404 para rutas de API no reconocidas.

---

## 2. MIME types para `.mjs` y `.cjs` ✅

**Implementado:** La condición del middleware ahora incluye `.mjs` y `.cjs`.

---

## 3. Hardcodeo de puerto en `sliceFrameworkProtection` ✅

**Implementado:** `api/index.js` ahora pasa `port: PORT` (resuelto desde `process.env.PORT` → `sliceConfig.json` → 3001). El middleware recibe el puerto real dinámicamente.

---

## 4. Cabeceras de seguridad básicas ✅

**Implementado:** Se agregaron `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 5. Compresión gzip/brotli ✅

**Implementado:** `api/framework/server.js` usa `compression({ threshold: 0 })`. La dependencia ya está en `slicejs-web-framework` (el paquete del framework), no en el proyecto del cliente.

---

## 6. Rate limiting para producción (opcional)

**Problema:** Los endpoints de API (como `/slice-env.json`) no tienen límite de peticiones, permitiendo abuso.

**Solución:** Usar `express-rate-limit` en producción:

```bash
pnpm add express-rate-limit
```

```js
import rateLimit from 'express-rate-limit';

if (runMode === 'production') {
  app.use('/api', rateLimit({ windowMs: 60_000, max: 100 }));
}
```
## 7. Ocultar lógica del server del usuario final ✅

**Implementado:** La lógica de `api/index.js` se movió a `api/framework/server.js` del paquete `slicejs-web-framework`. El `api/index.js` del proyecto ahora es solo un wrapper que importa `createSliceServer` y lo ejecuta.

## Estado actual del ecosistema

| Repositorio | Estado |
|---|---|
| **slice.js** (framework core) | Items 1-5 y 7 implementados ✅ |
| **slicejs_docs** (docs site) | Sitemap desactualizado |
| **slicejs_visual_library** (componentes) | Sitemap desactualizado |
| **portfolio** (demo/portfolio) | Sitemap desactualizado |
| **slicejs-cli** (CLI tool) | Sin incidencias reportadas |
