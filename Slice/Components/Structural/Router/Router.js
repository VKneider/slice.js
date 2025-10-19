export default class Router {
   constructor(routes) {
      this.routes = routes;
      this.activeRoute = null;
      this.pathToRouteMap = this.createPathToRouteMap(routes);
      
      // Navigation Guards
      this._beforeEachGuard = null;
      this._afterEachGuard = null;
      
      // Router state
      this._started = false;
      this._autoStartTimeout = null;
      
      // Sistema de caché optimizado
      this.routeContainersCache = new Map();
      this.lastCacheUpdate = 0;
      this.CACHE_DURATION = 100; // ms - caché muy corto pero efectivo
      
      // Observer para invalidar caché automáticamente
      this.setupMutationObserver();
   }

   /**
    * Inicializa el router
    * Si el usuario no llama start() manualmente, se auto-inicia después de un delay
    */
   init() {
      window.addEventListener('popstate', this.onRouteChange.bind(this));
      
      // Auto-start después de 50ms si el usuario no llama start() manualmente
      // Esto da tiempo para que el usuario configure guards si lo necesita
      this._autoStartTimeout = setTimeout(async () => {
         if (!this._started) {
            slice.logger.logInfo('Router', 'Auto-starting router (no manual start() called)');
            await this.start();
         }
      }, 50);
   }

   /**
    * Inicia el router y carga la ruta inicial
    * OPCIONAL: Solo necesario si usas guards (beforeEach/afterEach)
    * Si no lo llamas, el router se auto-inicia después de 50ms
    */
   async start() {
      // Prevenir múltiples llamadas
      if (this._started) {
         slice.logger.logWarning('Router', 'start() already called');
         return;
      }
      
      // Cancelar auto-start si existe
      if (this._autoStartTimeout) {
         clearTimeout(this._autoStartTimeout);
         this._autoStartTimeout = null;
      }
      
      this._started = true;
      await this.loadInitialRoute();
   }

   // ============================================
   // NAVIGATION GUARDS API
   // ============================================

   /**
    * Registra un guard que se ejecuta ANTES de cada navegación
    * Puede bloquear o redirigir la navegación
    * @param {Function} guard - Función (to, from, next) => {}
    */
   beforeEach(guard) {
      if (typeof guard !== 'function') {
         slice.logger.logError('Router', 'beforeEach expects a function');
         return;
      }
      this._beforeEachGuard = guard;
   }

   /**
    * Registra un guard que se ejecuta DESPUÉS de cada navegación
    * No puede bloquear la navegación
    * @param {Function} guard - Función (to, from) => {}
    */
   afterEach(guard) {
      if (typeof guard !== 'function') {
         slice.logger.logError('Router', 'afterEach expects a function');
         return;
      }
      this._afterEachGuard = guard;
   }

   /**
    * Crea un objeto con información de ruta para los guards
    * @param {Object} route - Objeto de ruta
    * @param {Object} params - Parámetros de la ruta
    * @param {String} requestedPath - Path original solicitado
    * @returns {Object} Objeto con path, component, params, query, metadata
    */
   _createRouteInfo(route, params = {}, requestedPath = null) {
      if (!route) {
         return {
            path: requestedPath || '/404',
            component: 'NotFound',
            params: {},
            query: this._parseQueryParams(),
            metadata: {}
         };
      }

      return {
         path: requestedPath || route.fullPath || route.path,
         component: route.parentRoute ? route.parentRoute.component : route.component,
         params: params,
         query: this._parseQueryParams(),
         metadata: route.metadata || {}
      };
   }

   /**
    * Parsea los query parameters de la URL actual
    * @returns {Object} Objeto con los query params
    */
   _parseQueryParams() {
      const queryString = window.location.search;
      if (!queryString) return {};

      const params = {};
      const urlParams = new URLSearchParams(queryString);
      
      for (const [key, value] of urlParams) {
         params[key] = value;
      }
      
      return params;
   }

   /**
    * Ejecuta el beforeEach guard si existe
    * @param {Object} to - Información de ruta destino
    * @param {Object} from - Información de ruta origen
    * @returns {String|null} Path de redirección o null si continúa
    */
   async _executeBeforeEachGuard(to, from) {
      if (!this._beforeEachGuard) {
         return null;
      }

      let redirectPath = null;
      let nextCalled = false;

      const next = (path) => {
         if (nextCalled) {
            slice.logger.logWarning('Router', 'next() called multiple times in guard');
            return;
         }
         nextCalled = true;

         if (path && typeof path === 'string') {
            redirectPath = path;
         }
      };

      try {
         await this._beforeEachGuard(to, from, next);

         // Si no se llamó next(), loguear advertencia pero continuar
         if (!nextCalled) {
            slice.logger.logWarning(
               'Router', 
               'beforeEach guard did not call next(). Navigation will continue.'
            );
         }

         return redirectPath;
      } catch (error) {
         slice.logger.logError('Router', 'Error in beforeEach guard', error);
         return null; // En caso de error, continuar con la navegación
      }
   }

   /**
    * Ejecuta el afterEach guard si existe
    * @param {Object} to - Información de ruta destino
    * @param {Object} from - Información de ruta origen
    */
   _executeAfterEachGuard(to, from) {
      if (!this._afterEachGuard) {
         return;
      }

      try {
         this._afterEachGuard(to, from);
      } catch (error) {
         slice.logger.logError('Router', 'Error in afterEach guard', error);
      }
   }

   // ============================================
   // ROUTING CORE (MODIFICADO CON GUARDS)
   // ============================================

   async navigate(path, _redirectChain = []) {
      const currentPath = window.location.pathname;
      
      
      // Detectar loops infinitos: si ya visitamos esta ruta en la cadena de redirecciones
      if (_redirectChain.includes(path)) {
         slice.logger.logError(
            'Router', 
            `Guard redirection loop detected: ${_redirectChain.join(' → ')} → ${path}`
         );
         return;
      }
      
      // Límite de seguridad: máximo 10 redirecciones
      if (_redirectChain.length >= 10) {
         slice.logger.logError(
            'Router',
            `Too many redirections: ${_redirectChain.join(' → ')} → ${path}`
         );
         return;
      }
      
      // Obtener información de ruta actual
      const { route: fromRoute, params: fromParams } = this.matchRoute(currentPath);
      const from = this._createRouteInfo(fromRoute, fromParams, currentPath);

      // Obtener información de ruta destino
      const { route: toRoute, params: toParams } = this.matchRoute(path);
      const to = this._createRouteInfo(toRoute, toParams, path); // ← PASAR EL PATH AQUÍ


      // EJECUTAR BEFORE EACH GUARD
      const redirectPath = await this._executeBeforeEachGuard(to, from);

      // Si el guard redirige, agregar ruta actual a la cadena y navegar a la nueva ruta
      if (redirectPath) {
         const newChain = [..._redirectChain, path];

         return this.navigate(redirectPath, newChain);
      }

      // No hay redirección - continuar con la navegación normal
      window.history.pushState({}, path, window.location.origin + path);
      await this._performNavigation(to, from);
   }

   /**
    * Método interno para ejecutar la navegación después de pasar los guards
    * @param {Object} to - Información de ruta destino
    * @param {Object} from - Información de ruta origen
    */
   async _performNavigation(to, from) {
      // Renderizar la nueva ruta
      await this.onRouteChange();

      // EJECUTAR AFTER EACH GUARD
      this._executeAfterEachGuard(to, from);
   }

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
         await this.renderRoutesInComponent(existingComponent);
      } else {
         const component = await slice.build(componentName, {
            params,
            sliceId: sliceId,
         });

         targetElement.innerHTML = '';
         targetElement.appendChild(component);
         
         await this.renderRoutesInComponent(component);
      }

      // Invalidar caché después de cambios importantes en el DOM
      this.invalidateCache();

      if (slice.loading) {
         slice.loading.stop();
      }

      slice.router.activeRoute = route;
   }

   async loadInitialRoute() {
      const path = window.location.pathname;
      const { route, params } = this.matchRoute(path);

      // Para la carga inicial, también ejecutar guards
      const from = this._createRouteInfo(null, {}, null);
      const to = this._createRouteInfo(route, params, path); // ← PASAR EL PATH AQUÍ

      // EJECUTAR BEFORE EACH GUARD en carga inicial
      const redirectPath = await this._executeBeforeEachGuard(to, from);

      if (redirectPath) {
         return this.navigate(redirectPath);
      }

      await this.handleRoute(route, params);

      // EJECUTAR AFTER EACH GUARD en carga inicial
      this._executeAfterEachGuard(to, from);
   }

   // ============================================
   // MÉTODOS EXISTENTES (SIN CAMBIOS)
   // ============================================

   setupMutationObserver() {
      if (typeof MutationObserver !== 'undefined') {
         this.observer = new MutationObserver((mutations) => {
            let shouldInvalidateCache = false;
            
            mutations.forEach((mutation) => {
               if (mutation.type === 'childList') {
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

   async renderRoutesComponentsInPage(searchContainer = document) {
      let routerContainersFlag = false;
      const routeContainers = this.getCachedRouteContainers(searchContainer);

      for (const routeContainer of routeContainers) {
         try {
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

   getCachedRouteContainers(container) {
      const containerKey = container === document ? 'document' : container.sliceId || 'anonymous';
      const now = Date.now();
      
      if (this.routeContainersCache.has(containerKey) && 
          (now - this.lastCacheUpdate) < this.CACHE_DURATION) {
         return this.routeContainersCache.get(containerKey);
      }

      const routeContainers = this.findAllRouteContainersOptimized(container);
      this.routeContainersCache.set(containerKey, routeContainers);
      this.lastCacheUpdate = now;
      
      return routeContainers;
   }

   findAllRouteContainersOptimized(container) {
      const routeContainers = [];
      
      const walker = document.createTreeWalker(
         container,
         NodeFilter.SHOW_ELEMENT,
         {
            acceptNode: (node) => {
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

   async renderRoutesInComponent(component) {
      if (!component) {
         slice.logger.logWarning('Router', 'No component provided for route rendering');
         return false;
      }

      return await this.renderRoutesComponentsInPage(component);
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