import routes from './routes.js';

export default class Router {
   constructor() {
      this.routes = routes;
      this.activeRoute = null;
      this.pathToRouteMap = this.createPathToRouteMap(routes);
   }

   async init() {
      await this.loadInitialRoute();
      window.addEventListener('popstate', this.onRouteChange.bind(this));
   }

   createPathToRouteMap(routes, basePath = '') {
      const pathToRouteMap = new Map();
  
      for (const route of routes) {
          const fullPath = `${basePath}${route.path}`.replace(/\/+/g, '/'); // Normaliza las barras diagonales
          pathToRouteMap.set(fullPath, { ...route, fullPath });
  
          // Si tiene rutas secundarias, también agregarlas al mapa
          if (route.children) {
              const childPathToRouteMap = this.createPathToRouteMap(route.children, fullPath);
              for (const [childPath, childRoute] of childPathToRouteMap.entries()) {
                  pathToRouteMap.set(childPath, childRoute);
              }
          }
      }
  
      return pathToRouteMap;
  }

   async renderRoutesComponentsInPage() {
      const routeContainers = document.querySelectorAll('slice-route, slice-multi-route');
      let routerContainersFlag = false;

      for (const routeContainer of routeContainers) {
         let response = await routeContainer.renderIfCurrentRoute();
         if (response) {
            this.activeRoute = routeContainer.props;
            routerContainersFlag = true;
         }
      }

      return routerContainersFlag;
   }

   async onRouteChange() {
      const path = window.location.pathname;
      const routeContainersFlag = await this.renderRoutesComponentsInPage();

      if (routeContainersFlag) {
         return;
      }

      const { route, params } = this.matchRoute(path);
      if (route) {
         await this.handleRoute(route, params);
      }
   }

   async navigate(path) {
      window.history.pushState({}, path, window.location.origin + path);
      await this.onRouteChange();
   }

   async handleRoute(route, params) {
      const targetElement = document.querySelector('#app');
      const existingComponent = slice.controller.getComponent(`route-${route.component}`);

      if (slice.loading) {
         slice.loading.start();
      }

      if (existingComponent) {
         targetElement.innerHTML = '';
         if (existingComponent.update) {
            existingComponent.props = { ...existingComponent.props, ...params };
            await existingComponent.update();
         }
         targetElement.appendChild(existingComponent);
      } else {
         const component = await slice.build(route.component, {
            params,
            sliceId: `route-${route.component}`,
         });
         targetElement.innerHTML = '';
         targetElement.appendChild(component);
      }

      if (slice.loading) {
         slice.loading.stop();
      }

      slice.router.activeRoute = route;
   }

   async loadInitialRoute() {
      const path = window.location.pathname;
      const { route, params } = this.matchRoute(path);

      await this.handleRoute(route, params);

      await this.renderRoutesComponentsInPage();
   }

   matchRoute(path) {
      // 1. Buscar coincidencia exacta en el mapa
      const exactMatch = this.pathToRouteMap.get(path);
      if (exactMatch) {
         return { route: exactMatch, params: {} };
      }
   
      // 2. Buscar coincidencias en rutas con parámetros (que contengan la sintaxis `${...}`)
      for (const [routePattern, route] of this.pathToRouteMap.entries()) {
         if (routePattern.includes('${')) {
            const { regex, paramNames } = this.compilePathPattern(routePattern);
            const match = path.match(regex);
            if (match) {
               const params = {};
               paramNames.forEach((name, i) => {
                  params[name] = match[i + 1]; // El grupo 0 es la coincidencia completa
               });
               return { route, params };
            }
         }
      }
   
      // 3. Si no hay coincidencias, retornar la ruta 404 (suponiendo que exista)
      const notFoundRoute = this.pathToRouteMap.get('/404');
      return { route: notFoundRoute, params: {} };
   }

   /**
 * Convierte un patrón de ruta con parámetros en una expresión regular.
 * Por ejemplo, el patrón "/User/${id}" se convertirá en:
 *   - regex: /^\/User\/([^/]+)$/
 *   - paramNames: ['id']
 */
compilePathPattern(pattern) {
   const paramNames = [];
   // Reemplaza cada aparición de ${param} por un grupo capturador que coincida con cualquier cosa
   // que no sea una barra (para que solo capture hasta la siguiente barra)
   const regexPattern = '^' + pattern.replace(/\$\{([^}]+)\}/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
   }) + '$';

   return { regex: new RegExp(regexPattern), paramNames };
}

}
