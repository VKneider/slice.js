// Node ESM resolve hook so the REAL Controller can load under `node --test`.
//
// Controller.js does `import components from '/Components/components.js'` — a
// browser-absolute path that the dev server serves but node can't resolve. We
// map only that exact specifier to a small fixture components map (just data,
// the same shape the real components.js exports). Everything else resolves
// normally, so the tests exercise the real Slice + Controller code, not mocks.
const COMPONENTS = { Probe: 'Service', ModalProbe: 'Visual' };
const STUB = `export default ${JSON.stringify(COMPONENTS)};`;

export async function resolve(specifier, context, nextResolve) {
   if (specifier === '/Components/components.js') {
      return {
         url: `data:text/javascript,${encodeURIComponent(STUB)}`,
         shortCircuit: true
      };
   }
   return nextResolve(specifier, context);
}
