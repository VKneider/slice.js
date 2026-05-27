<div align="center">
  <img src="readme_images/Slice.js-logo.svg" alt="Slice.js logo" width="150" />
  <h1>Slice.js</h1>
  <p>Component-Based Web Development Framework</p>
  <p>
    <a href="https://slice-js-docs.vercel.app/Documentation"><strong>Explore the docs »</strong></a>
    <br />
    <a href="https://slice-js-docs.vercel.app/">View Demo</a>
    ·
    <a href="https://github.com/VKneider/slice.js/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    ·
    <a href="https://github.com/VKneider/slice.js/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

## Sobre este repositorio

Este repositorio contiene el core del framework Slice.js: el runtime de componentes, el sistema de routing, el motor de bundles y la API del framework. Es el paquete publicado como `slicejs-web-framework` en npm.

## Requisitos

- Node.js >= 20
- npm o pnpm

## Desarrollo local

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/VKneider/slice.js.git
   cd slice.js
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Inicializar proyecto de prueba** (opcional, para desarrollo con el CLI)
   ```bash
   npx slicejs-cli init
   ```

4. **Probar cambios localmente**
   ```bash
   npx slicejs-cli dev
   ```

## Comandos disponibles

El framework no expone comandos directamente. Se usa a través del CLI (`slicejs-cli`):

| Comando | Descripción |
|---------|-------------|
| `npx slicejs-cli init` | Inicializar un proyecto Slice.js |
| `npx slicejs-cli dev` | Iniciar servidor de desarrollo |
| `npx slicejs-cli build` | Compilar para producción |
| `npx slicejs-cli start` | Servir build de producción |

## Documentación

La documentación completa está en [slice-js-docs.vercel.app](https://slice-js-docs.vercel.app/Documentation).

Slice.js también provee un servidor MCP para acceso programático a la documentación:

```bash
npx slicejs-mcp
```

Esto permite que asistentes de IA y herramientas consulten, busquen y recuperen documentación de Slice.js.

## Estructura del proyecto

```
slice.js/
├── api/           # API server del framework
├── src/           # Código fuente del runtime
│   ├── App/       # Motor de aplicación
│   ├── Components/# Sistema de componentes
│   └── ...        # Routing, bundles, utilidades
├── Slice/         # Framework para componentes visuales
├── types/         # Declaraciones TypeScript
└── docs/          # Guías de contribución
```

## Contribuir

Damos la bienvenida a contribuciones. Revisa las guías en [CONTRIBUTING.md](docs/CONTRIBUTING.md) antes de enviar cambios.

## Licencia

Distribuido bajo licencia MIT. Ver `LICENSE` para más información.

## Contacto

Slice.js - [@VKneider](https://github.com/VKneider)

Project Link: [https://github.com/VKneider/slice.js](https://github.com/VKneider/slice.js)
