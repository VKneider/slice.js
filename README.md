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

## About this repository

This repository contains the core of the Slice.js framework: the component runtime, routing system, bundle engine, and framework API. It is the package published as `slicejs-web-framework` on npm.

## Prerequisites

- Node.js >= 20
- npm or pnpm

## Local development

1. **Clone the repository**
   ```bash
   git clone https://github.com/VKneider/slice.js.git
   cd slice.js
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize a test project** (optional, for CLI-based development)
   ```bash
   npx slicejs-cli init
   ```

4. **Test changes locally**
   ```bash
   npx slicejs-cli dev
   ```

## Available commands

The framework does not expose commands directly. Use it through the CLI (`slicejs-cli`):

| Command | Description |
|---------|-------------|
| `npx slicejs-cli init` | Initialize a Slice.js project |
| `npx slicejs-cli dev` | Start development server |
| `npx slicejs-cli build` | Build for production |
| `npx slicejs-cli start` | Serve production build |

## Documentation

Full documentation is available at [slice-js-docs.vercel.app](https://slice-js-docs.vercel.app/Documentation).

Slice.js also provides an MCP server for programmatic documentation access:

```bash
npx slicejs-mcp
```

This allows AI assistants and tools to query, search, and retrieve Slice.js documentation.

## Project structure

```
slice.js/
├── api/           # Framework API server
├── src/           # Runtime source code
│   ├── App/       # Application engine
│   ├── Components/# Component system
│   └── ...        # Routing, bundles, utilities
├── Slice/         # Visual component framework
├── types/         # TypeScript declarations
└── docs/          # Contribution guides
```

## Contributing

We welcome contributions. Please review the guidelines in [CONTRIBUTING.md](docs/CONTRIBUTING.md) before submitting changes.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Slice.js - [@VKneider](https://github.com/VKneider)

Project Link: [https://github.com/VKneider/slice.js](https://github.com/VKneider/slice.js)
