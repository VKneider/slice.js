/**
 * @typedef {Object} RouteConfig
 * @property {string} path
 * @property {string} component
 * @property {RouteConfig[]} [children]
 * @property {Object} [metadata]
 * @property {string} [fullPath]
 * @property {string|null} [parentPath]
 * @property {RouteConfig|null} [parentRoute]
 */

/**
 * @typedef {Object} RouteInfo
 * @property {string} path
 * @property {string} component
 * @property {Object} params
 * @property {Object} query
 * @property {Object} metadata
 */

/**
 * @typedef {Object} GuardRedirect
 * @property {string} path
 * @property {boolean} [replace]
 */

/**
 * @typedef {Object} RouteMatch
 * @property {RouteConfig|null} route
 * @property {Object} params
 * @property {RouteConfig} [childRoute]
 */

/**
 * @callback RouterNext
 * @param {void|false|string|{ path: string, replace?: boolean }} [arg]
 * @returns {void}
 */

export default class Router {
   /**
    * @param {RouteConfig[]} routes
    */
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
    * Si el usuario no llama start() manualmente, se auto-inicia despues de un delay
    * @returns {void}
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
    * Si no lo llamas, el router se auto-inicia despues de 50ms
    * @returns {Promise<void>}
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
    * Registra un guard que se ejecuta ANTES de cada navegacion.
    * Puede bloquear o redirigir la navegacion mediante next().
    * @param {(to: RouteInfo, from: RouteInfo, next: RouterNext) => void|Promise<void>} guard
    * @returns {void}
    */
   beforeEach(guard) {
      if (typeof guard !== 'function') {
         slice.logger.logError('Router', 'beforeEach expects a function');
         return;
      }
      this._beforeEachGuard = guard;
   }

   /**
    * Registra un guard que se ejecuta DESPUES de cada navegacion.
    * No puede bloquear la navegacion.
    * @param {(to: RouteInfo, from: RouteInfo) => void} guard
    * @returns {void}
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
   /**
    * Build route info used by guards and events.
    * @param {RouteConfig|null} route
    * @param {Object} [params]
    * @param {string|null} [requestedPath]
    * @returns {RouteInfo}
    */
   _createRouteInfo(route, params = {}, requestedPath = null) {
      if (!route) {
         return {
            path: requestedPath || '/404',
            component: 'NotFound',
            params: {},
            query: this._parseQueryParams(),
            metadata: {},
         };
      }

      return {
         path: requestedPath || route.fullPath || route.path,
         component: route.parentRoute ? route.parentRoute.component : route.component,
         params: params,
         query: this._parseQueryParams(),
         metadata: route.metadata || {},
      };
   }

   /**
    * Parsea los query parameters de la URL actual
    * @returns {Object} Objeto con los query params
    */
   /**
    * Parse query params from current URL.
    * @returns {Object}
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
    * @returns {Object|null} Objeto con redirectPath y options, o null si continúa
    */
   /**
    * Execute beforeEach guard if defined.
    * @param {RouteInfo} to
    * @param {RouteInfo} from
    * @returns {Promise<{ path: string|false, options: { replace?: boolean } }|null>}
    */
   async _executeBeforeEachGuard(to, from) {
      if (!this._beforeEachGuard) {
         return null;
      }

      let redirectPath = null;
      let redirectOptions = {};
      let nextCalled = false;

      const next = (arg) => {
         if (nextCalled) {
            slice.logger.logWarning('Router', 'next() called multiple times in guard');
            return;
         }
         nextCalled = true;

         // Caso 1: Sin argumentos - continuar navegación
         if (arg === undefined) {
            return;
         }

         // Caso 2: false - cancelar navegación
         if (arg === false) {
            redirectPath = false;
            return;
         }

         // Caso 3: String - redirección simple (backward compatibility)
         if (typeof arg === 'string') {
            redirectPath = arg;
            redirectOptions = { replace: false };
            return;
         }

         // Caso 4: Objeto - redirección con opciones
         if (typeof arg === 'object' && arg.path) {
            redirectPath = arg.path;
            redirectOptions = {
               replace: arg.replace || false,
            };
            return;
         }

         // Argumento inválido
         slice.logger.logError(
            'Router',
            'Invalid argument passed to next(). Expected string, object with path, false, or undefined.'
         );
      };

      try {
         await this._beforeEachGuard(to, from, next);

         // Si no se llamó next(), loguear advertencia pero continuar
         if (!nextCalled) {
            slice.logger.logWarning('Router', 'beforeEach guard did not call next(). Navigation will continue.');
         }

         // Retornar tanto el path como las opciones
         return redirectPath ? { path: redirectPath, options: redirectOptions } : null;
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
   /**
    * Execute afterEach guard if defined.
    * @param {RouteInfo} to
    * @param {RouteInfo} from
    * @returns {void}
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

   /**
    * Navigate to a route path with guards support. Add replace to do router.replace() instead of push.
    * @param {string} path
    * @param {string[]} [_redirectChain]
    * @param {{ replace?: boolean }} [_options]
    * @returns {Promise<void>}
    */
   async navigate(path, _redirectChain = [], _options = {}) {
      const currentPath = window.location.pathname;

      // Detectar loops infinitos: si ya visitamos esta ruta en la cadena de redirecciones
      if (_redirectChain.includes(path)) {
         slice.logger.logError('Router', `Guard redirection loop detected: ${_redirectChain.join(' → ')} → ${path}`);
         return;
      }

      // Límite de seguridad: máximo 10 redirecciones
      if (_redirectChain.length >= 10) {
         slice.logger.logError('Router', `Too many redirections: ${_redirectChain.join(' → ')} → ${path}`);
         return;
      }

      // Obtener información de ruta actual
      const { route: fromRoute, params: fromParams } = this.matchRoute(currentPath);
      const from = this._createRouteInfo(fromRoute, fromParams, currentPath);

      // Obtener información de ruta destino
      const { route: toRoute, params: toParams } = this.matchRoute(path);
      const to = this._createRouteInfo(toRoute, toParams, path);

      // EJECUTAR BEFORE EACH GUARD
      const guardResult = await this._executeBeforeEachGuard(to, from);

      // Si el guard redirige
      if (guardResult && guardResult.path) {
         const newChain = [..._redirectChain, path];
         return this.navigate(guardResult.path, newChain, guardResult.options);
      }

      // Si el guard cancela la navegación (next(false))
      if (guardResult && guardResult.path === false) {
         slice.logger.logInfo('Router', 'Navigation cancelled by guard');
         return;
      }

      // No hay redirección - continuar con la navegación normal
      // Usar replace o push según las opciones
      if (_options.replace) {
         window.history.replaceState({}, path, window.location.origin + path);
      } else {
         window.history.pushState({}, path, window.location.origin + path);
      }

      await this._performNavigation(to, from);
   }

   /**
    * Método interno para ejecutar la navegación después de pasar los guards
    * @param {Object} to - Información de ruta destino
    * @param {Object} from - Información de ruta origen
    */
   /**
    * Perform navigation after guards.
    * @param {RouteInfo} to
    * @param {RouteInfo} from
    * @returns {Promise<void>}
    */
   async _performNavigation(to, from) {
      // Renderizar la nueva ruta
      await this.onRouteChange();

      // EJECUTAR AFTER EACH GUARD
      this._executeAfterEachGuard(to, from);

      // Emitir evento de cambio de ruta
      this._emitRouteChange(to, from);
   }

   /**
    * React to URL changes and render routes.
    * @returns {Promise<void>}
    */
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

   /**
    * Build or update the active route component.
    * @param {RouteConfig} route
    * @param {Object} params
    * @returns {Promise<void>}
    */
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

   /**
    * Load initial route and run guards.
    * @returns {Promise<void>}
    */
   async loadInitialRoute() {
      const path = window.location.pathname;
      const { route, params } = this.matchRoute(path);

      // Para la carga inicial, también ejecutar guards
      const from = this._createRouteInfo(null, {}, null);
      const to = this._createRouteInfo(route, params, path);

      // EJECUTAR BEFORE EACH GUARD en carga inicial
      const guardResult = await this._executeBeforeEachGuard(to, from);

      if (guardResult && guardResult.path) {
         return this.navigate(guardResult.path, [], guardResult.options);
      }

      // Si el guard cancela la navegación inicial (caso raro pero posible)
      if (guardResult && guardResult.path === false) {
         slice.logger.logWarning('Router', 'Initial route navigation cancelled by guard');
         return;
      }

      await this.handleRoute(route, params);

      // EJECUTAR AFTER EACH GUARD en carga inicial
      this._executeAfterEachGuard(to, from);

      // Emitir evento de cambio de ruta
      this._emitRouteChange(to, from);
   }

   /**
    * Emitir evento de cambio de ruta
    * @param {Object} to
    * @param {Object} from
    */
   /**
    * Emit route change event.
    * @param {RouteInfo} to
    * @param {RouteInfo} from
    * @returns {void}
    */
   _emitRouteChange(to, from) {
      const payload = { to, from };

      if (slice.eventsConfig?.enabled && slice.events && typeof slice.events.emit === 'function') {
         slice.events.emit('router:change', payload);
         return;
      }

      window.dispatchEvent(new CustomEvent('router:change', { detail: payload }));
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

                  const hasRouteNodes = [...addedNodes, ...removedNodes].some(
                     (node) =>
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
            subtree: true,
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
            parentRoute: parentRoute,
         };

         pathToRouteMap.set(fullPath, routeWithParent);

         if (route.children) {
            const childPathToRouteMap = this.createPathToRouteMap(route.children, fullPath, routeWithParent);

            for (const [childPath, childRoute] of childPathToRouteMap.entries()) {
               pathToRouteMap.set(childPath, childRoute);
            }
         }
      }

      return pathToRouteMap;
   }

   /**
    * Render any Route/MultiRoute components in a container.
    * @param {Document|HTMLElement} [searchContainer]
    * @returns {Promise<boolean>}
    */
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

      if (this.routeContainersCache.has(containerKey) && now - this.lastCacheUpdate < this.CACHE_DURATION) {
         return this.routeContainersCache.get(containerKey);
      }

      const routeContainers = this.findAllRouteContainersOptimized(container);
      this.routeContainersCache.set(containerKey, routeContainers);
      this.lastCacheUpdate = now;

      return routeContainers;
   }

   findAllRouteContainersOptimized(container) {
      const routeContainers = [];

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
         acceptNode: (node) => {
            if (node.tagName === 'SLICE-ROUTE' || node.tagName === 'SLICE-MULTI-ROUTE') {
               return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
         },
      });

      let node;
      while ((node = walker.nextNode())) {
         routeContainers.push(node);
      }

      return routeContainers;
   }

   /**
    * Render route containers inside a component.
    * @param {HTMLElement} component
    * @returns {Promise<boolean>}
    */
   async renderRoutesInComponent(component) {
      if (!component) {
         slice.logger.logWarning('Router', 'No component provided for route rendering');
         return false;
      }

      return await this.renderRoutesComponentsInPage(component);
   }

   /**
    * Match a path to a configured route.
    * @param {string} path
    * @returns {RouteMatch}
    */
   matchRoute(path) {
      const exactMatch = this.pathToRouteMap.get(path);
      if (exactMatch) {
         if (exactMatch.parentRoute) {
            return {
               route: exactMatch.parentRoute,
               params: {},
               childRoute: exactMatch,
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
                     childRoute: route,
                  };
               }

               return { route, params };
            }
         }
      }

      const notFoundRoute = this.pathToRouteMap.get('/404');
      return { route: notFoundRoute, params: {} };
   }

   /**
    * Compile a path pattern with ${param} segments.
    * @param {string} pattern
    * @returns {{ regex: RegExp, paramNames: string[] }}
    */
   compilePathPattern(pattern) {
      const paramNames = [];
      const regexPattern =
         '^' +
         pattern.replace(/\$\{([^}]+)\}/g, (_, paramName) => {
            paramNames.push(paramName);
            return '([^/]+)';
         }) +
         '$';

      return { regex: new RegExp(regexPattern), paramNames };
   }
}
