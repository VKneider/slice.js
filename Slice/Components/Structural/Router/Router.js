export default class Router {
   constructor(routes) {
      this.routes = routes;
      this.activeRoute = null;
      this.pathToRouteMap = this.createPathToRouteMap(routes);
   }

   async init() {
      await this.loadInitialRoute();
      window.addEventListener('popstate', this.onRouteChange.bind(this));
   }

   createPathToRouteMap(routes, basePath = '', parentRoute = null) {
      const pathToRouteMap = new Map();
  
      for (const route of routes) {
          const fullPath = `${basePath}${route.path}`.replace(/\/+/g, '/');
          
          // Guardar la referencia a la ruta padre
          const routeWithParent = { 
              ...route, 
              fullPath,
              parentPath: parentRoute ? parentRoute.fullPath : null,
              parentRoute: parentRoute
          };
          
          pathToRouteMap.set(fullPath, routeWithParent);
  
          // Si tiene rutas secundarias, también agregarlas al mapa
          if (route.children) {
              const childPathToRouteMap = this.createPathToRouteMap(
                  route.children, 
                  fullPath, 
                  routeWithParent // Pasar la ruta actual como padre
              );
              
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
      
      // Si tenemos una ruta con parentRoute, usamos el componente del padre
      const componentName = route.parentRoute ? route.parentRoute.component : route.component;
      const sliceId = `route-${componentName}`;
      
      const existingComponent = slice.controller.getComponent(sliceId);

      if (slice.loading) {
         slice.loading.start();
      }

      if (existingComponent) {
         targetElement.innerHTML = '';
         if (existingComponent.update) {
            existingComponent.props = { ...existingComponent.props, ...params };
            await existingComponent.update();
         }
         await this.renderRoutesComponentsInPage();
         targetElement.appendChild(existingComponent);
      } else {
         const component = await slice.build(componentName, {
            params,
            sliceId: sliceId,
         });
         await this.renderRoutesComponentsInPage();
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
         // Si es una ruta hija y tiene un padre definido, devolvemos el padre en su lugar
         if (exactMatch.parentRoute) {
            // Mantenemos la información de parámetros que viene de la ruta actual
            return { 
               route: exactMatch.parentRoute, 
               params: {},
               childRoute: exactMatch // Guardamos la referencia a la ruta hija original
            };
         }
         return { route: exactMatch, params: {} };
      }
   
      // 2. Buscar coincidencias en rutas con parámetros
      for (const [routePattern, route] of this.pathToRouteMap.entries()) {
         if (routePattern.includes('${')) {
            const { regex, paramNames } = this.compilePathPattern(routePattern);
            const match = path.match(regex);
            if (match) {
               const params = {};
               paramNames.forEach((name, i) => {
                  params[name] = match[i + 1];
               });
               
               // Si es una ruta hija, devolvemos el padre con los parámetros
               if (route.parentRoute) {
                  return { 
                     route: route.parentRoute, 
                     params: params,
                     childRoute: route
                  };
               }
               
               return { route, params };
            }
         }
      }
   
      // 3. Si no hay coincidencias, retornar la ruta 404
      const notFoundRoute = this.pathToRouteMap.get('/404');
      return { route: notFoundRoute, params: {} };
   }

   compilePathPattern(pattern) {
      const paramNames = [];
      const regexPattern = '^' + pattern.replace(/\$\{([^}]+)\}/g, (_, paramName) => {
         paramNames.push(paramName);
         return '([^/]+)';
      }) + '$';

      return { regex: new RegExp(regexPattern), paramNames };
   }
}