export default class Router {
   constructor(routes) {
      this.routes = routes;
      this.activeRoute = null;
      this.pathToRouteMap = this.createPathToRouteMap(routes);
      
      // NUEVO: Sistema de caché optimizado
      this.routeContainersCache = new Map();
      this.lastCacheUpdate = 0;
      this.CACHE_DURATION = 100; // ms - caché muy corto pero efectivo
      
      // NUEVO: Observer para invalidar caché automáticamente
      this.setupMutationObserver();
   }

   async init() {
      await this.loadInitialRoute();
      window.addEventListener('popstate', this.onRouteChange.bind(this));
   }

   // NUEVO: Observer para detectar cambios en el DOM
   setupMutationObserver() {
      if (typeof MutationObserver !== 'undefined') {
         this.observer = new MutationObserver((mutations) => {
            let shouldInvalidateCache = false;
            
            mutations.forEach((mutation) => {
               if (mutation.type === 'childList') {
                  // Solo invalidar si se añadieron/removieron nodos que podrían ser rutas
                  const addedNodes = Array.from(mutation.addedNodes);
                  const removedNodes = Array.from(mutation.removedNodes);
                  
                  const hasRouteNodes = [...addedNodes, ...removedNodes].some(node => 
                     node.nodeType === Node.ELEMENT_NODE && 
                     (node.tagName === 'SLICE-ROUTE' || 
                      node.tagName === 'SLICE-MULTI-ROUTE' ||
                      node.querySelector?.('slice-route, slice-multi-route'))
                  );
                  
                  if (hasRouteNodes) {
                     shouldInvalidateCache = true;
                  }
               }
            });
            
            if (shouldInvalidateCache) {
               this.invalidateCache();
            }
         });
         
         this.observer.observe(document.body, {
            childList: true,
            subtree: true
         });
      }
   }

   // NUEVO: Invalidar caché
   invalidateCache() {
      this.routeContainersCache.clear();
      this.lastCacheUpdate = 0;
   }

   createPathToRouteMap(routes, basePath = '', parentRoute = null) {
      const pathToRouteMap = new Map();
  
      for (const route of routes) {
          const fullPath = `${basePath}${route.path}`.replace(/\/+/g, '/');
          
          const routeWithParent = { 
              ...route, 
              fullPath,
              parentPath: parentRoute ? parentRoute.fullPath : null,
              parentRoute: parentRoute
          };
          
          pathToRouteMap.set(fullPath, routeWithParent);

          if (route.children) {
              const childPathToRouteMap = this.createPathToRouteMap(
                  route.children, 
                  fullPath, 
                  routeWithParent
              );
              
              for (const [childPath, childRoute] of childPathToRouteMap.entries()) {
                  pathToRouteMap.set(childPath, childRoute);
              }
          }
      }
  
      return pathToRouteMap;
   }

   // OPTIMIZADO: Sistema de caché inteligente
   async renderRoutesComponentsInPage(searchContainer = document) {
      let routerContainersFlag = false;
      const routeContainers = this.getCachedRouteContainers(searchContainer);

      for (const routeContainer of routeContainers) {
         try {
            // Verificar que el componente aún esté conectado al DOM
            if (!routeContainer.isConnected) {
               this.invalidateCache();
               continue;
            }

            let response = await routeContainer.renderIfCurrentRoute();
            if (response) {
               this.activeRoute = routeContainer.props;
               routerContainersFlag = true;
            }
         } catch (error) {
            slice.logger.logError('Router', `Error rendering route container`, error);
         }
      }

      return routerContainersFlag;
   }

   // NUEVO: Obtener contenedores con caché
   getCachedRouteContainers(container) {
      const containerKey = container === document ? 'document' : container.sliceId || 'anonymous';
      const now = Date.now();
      
      // Verificar si el caché es válido
      if (this.routeContainersCache.has(containerKey) && 
          (now - this.lastCacheUpdate) < this.CACHE_DURATION) {
         return this.routeContainersCache.get(containerKey);
      }

      // Regenerar caché
      const routeContainers = this.findAllRouteContainersOptimized(container);
      this.routeContainersCache.set(containerKey, routeContainers);
      this.lastCacheUpdate = now;
      
      return routeContainers;
   }

   // OPTIMIZADO: Búsqueda más eficiente usando TreeWalker
   findAllRouteContainersOptimized(container) {
      const routeContainers = [];
      
      // Usar TreeWalker para una búsqueda más eficiente
      const walker = document.createTreeWalker(
         container,
         NodeFilter.SHOW_ELEMENT,
         {
            acceptNode: (node) => {
               // Solo aceptar nodos que sean slice-route o slice-multi-route
               if (node.tagName === 'SLICE-ROUTE' || node.tagName === 'SLICE-MULTI-ROUTE') {
                  return NodeFilter.FILTER_ACCEPT;
               }
               return NodeFilter.FILTER_SKIP;
            }
         }
      );

      let node;
      while (node = walker.nextNode()) {
         routeContainers.push(node);
      }

      return routeContainers;
   }

   // NUEVO: Método específico para renderizar rutas dentro de un componente
   async renderRoutesInComponent(component) {
      if (!component) {
         slice.logger.logWarning('Router', 'No component provided for route rendering');
         return false;
      }

      return await this.renderRoutesComponentsInPage(component);
   }

   // OPTIMIZADO: Debouncing para evitar múltiples llamadas seguidas
   async onRouteChange() {
      // Cancelar el timeout anterior si existe
      if (this.routeChangeTimeout) {
         clearTimeout(this.routeChangeTimeout);
      }

      // Debounce de 10ms para evitar múltiples llamadas seguidas
      this.routeChangeTimeout = setTimeout(async () => {
         const path = window.location.pathname;
         const routeContainersFlag = await this.renderRoutesComponentsInPage();

         if (routeContainersFlag) {
            return;
         }

         const { route, params } = this.matchRoute(path);
         if (route) {
            await this.handleRoute(route, params);
         }
      }, 10);
   }

   async navigate(path) {
      window.history.pushState({}, path, window.location.origin + path);
      await this.onRouteChange();
   }

   async handleRoute(route, params) {
      const targetElement = document.querySelector('#app');
      
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
         targetElement.appendChild(existingComponent);
      } else {
         const component = await slice.build(componentName, {
            params,
            sliceId: sliceId,
         });
         targetElement.innerHTML = '';
         targetElement.appendChild(component);
      }

      // Invalidar caché después de cambios importantes en el DOM
      this.invalidateCache();
      await this.renderRoutesComponentsInPage();

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
      const exactMatch = this.pathToRouteMap.get(path);
      if (exactMatch) {
         if (exactMatch.parentRoute) {
            return { 
               route: exactMatch.parentRoute, 
               params: {},
               childRoute: exactMatch
            };
         }
         return { route: exactMatch, params: {} };
      }
   
      for (const [routePattern, route] of this.pathToRouteMap.entries()) {
         if (routePattern.includes('${')) {
            const { regex, paramNames } = this.compilePathPattern(routePattern);
            const match = path.match(regex);
            if (match) {
               const params = {};
               paramNames.forEach((name, i) => {
                  params[name] = match[i + 1];
               });
               
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