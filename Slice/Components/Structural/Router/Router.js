import { applyRouteMetadata } from './applyRouteMetadata.js';

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
 * @property {string} path      the app path, without locale prefix
 * @property {string} component
 * @property {Object} params
 * @property {Object} query
 * @property {Object} metadata
 * @property {string|null} locale  the locale of this navigation (null without slice.translator)
 * @property {string} url       what the address bar shows (`/en/pricing` with routing)
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
      /** @type {Object|null} metadata of the route being shown */
      this.activeMetadata = null;
      this.pathToRouteMap = this.createPathToRouteMap(routes);

      // O(1) case-insensitive lookup for static routes, so a miss on the exact map
      // doesn't scan every route on each navigation. Param routes (which carry a
      // precompiled `compiled` regex) are excluded — they go through the param loop.
      this._staticLowerIndex = new Map();
      for (const [pattern, route] of this.pathToRouteMap.entries()) {
         if (!route.compiled) this._staticLowerIndex.set(pattern.toLowerCase(), route);
      }

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
      window.addEventListener('popstate', () => {
         try {
            this.onRouteChange();
         } catch (error) {
            slice.logger.error('Router', 'Error in popstate handler', error);
         }
      });

      this._autoStartTimeout = setTimeout(async () => {
         if (!this._started) {
            try {
               slice.logger.info('Router', 'Auto-starting router (no manual start() called)');
               await this.start();
            } catch (error) {
               slice.logger.error('Router', 'Auto-start failed', error);
            }
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
   // URL API — the router is the only reader of the URL
   // ============================================

   /**
    * The current app path: `window.location.pathname` without the locale prefix
    * (`/en/pricing` → `/pricing`). Components compare this with their routes instead of
    * reading `window.location` themselves.
    * @returns {string}
    */
   get path() {
      return this._appPath(window.location.pathname);
   }

   /**
    * The URL to put in an `<a href>` for an app path: `/pricing` → `/en/pricing` when the
    * locale is in the URL, `/pricing` otherwise. `{ locale }` links to another language.
    * External URLs, fragments and relative paths are returned as given.
    * @param {string} path
    * @param {{ locale?: string }} [options]
    * @returns {string}
    */
   href(path, options = {}) {
      const translator = slice.translator;
      return typeof translator?.localizePath === 'function' ? translator.localizePath(path, options.locale) : path;
   }

   /**
    * @param {string} url
    * @returns {string}
    */
   _appPath(url) {
      const translator = slice.translator;
      return typeof translator?.splitPath === 'function' ? translator.splitPath(url).path : url;
   }

   /**
    * The locale a navigation lands in and the URL it shows.
    * @param {string} appPath
    * @param {string|null} [locale]
    * @returns {{ locale: string|null, url: string }}
    */
   _localeAndUrl(appPath, locale = null) {
      const translator = slice.translator;
      const active = translator?.enabled ? locale || translator.locale : null;
      return { locale: active, url: this.href(appPath, active ? { locale: active } : {}) };
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
   _createRouteInfo(route, params = {}, requestedPath = null, locale = undefined) {
      const path = route ? requestedPath || route.fullPath || route.path : requestedPath || '/404';
      const where = this._localeAndUrl(path, locale);

      if (!route) {
         return {
            path,
            component: 'NotFound',
            params: {},
            query: this._parseQueryParams(),
            metadata: {},
            locale: where.locale,
            url: where.url,
         };
      }

      return {
         path,
         component: route.parentRoute ? route.parentRoute.component : route.component,
         params: params,
         query: this._parseQueryParams(),
         metadata: route.metadata || {},
         locale: where.locale,
         url: where.url,
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
         slice.logger.error('Router', `Error in beforeEach guard from "${from?.path}" to "${to?.path}"`, error);
         return { path: false, options: {} };
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
    * Navigate to a route path (guards run automatically).
    *
    * `path` is an app path (`/pricing`); the active locale is added to the URL when the
    * translator has `routing`. `{ locale: 'en' }` navigates to another language: its
    * dictionaries load before the URL changes, so the new page renders translated.
    * @param {string} path
    * @param {{ replace?: boolean, locale?: string }} [options] - `{ replace: true }` replaces history instead of pushing.
    * @returns {Promise<void>}
    */
   async navigate(path, options = {}, legacyOptions) {
      // Backward compatibility with the previous signature navigate(path, _redirectChain, _options):
      // if the 2nd argument is the internal redirect chain (an array) or a 3rd argument is passed,
      // use the 3rd argument as the options object.
      if (Array.isArray(options)) {
         options = legacyOptions || {};
      } else if (legacyOptions !== undefined) {
         options = legacyOptions || options;
      }
      return this._navigateWithGuards(path, options || {}, []);
   }

   /**
    * Internal navigation that tracks the guard redirection chain (loop protection).
    * @param {string} path
    * @param {{ replace?: boolean }} options
    * @param {string[]} redirectChain
    * @returns {Promise<void>}
    */
   async _navigateWithGuards(path, options, redirectChain) {
      const currentPath = this.path;
      const translator = slice.translator;

      // A path given with a prefix (`/en/pricing`) is the app path in that locale.
      const split = typeof translator?.splitPath === 'function' ? translator.splitPath(path) : { locale: null, path };
      path = split.path;
      let targetLocale = options.locale || split.locale || null;
      if (targetLocale && translator?.enabled) {
         try {
            targetLocale = await translator.preload(targetLocale);
         } catch (error) {
            slice.logger.logError('Router', `Cannot navigate to "${path}" in "${targetLocale}"`, error);
            return;
         }
      } else {
         targetLocale = null;
      }

      // Detectar loops infinitos: si ya visitamos esta ruta en la cadena de redirecciones
      if (redirectChain.includes(path)) {
         slice.logger.logError('Router', `Guard redirection loop detected: ${redirectChain.join(' → ')} → ${path}`);
         return;
      }

      // Límite de seguridad: máximo 10 redirecciones
      if (redirectChain.length >= 10) {
         slice.logger.logError('Router', `Too many redirections: ${redirectChain.join(' → ')} → ${path}`);
         return;
      }

      // Obtener información de ruta actual
      const { route: fromRoute, params: fromParams } = this.matchRoute(currentPath);
      const from = this._createRouteInfo(fromRoute, fromParams, currentPath);

      // Obtener información de ruta destino
      const { route: toRoute, params: toParams } = this.matchRoute(path);
      const to = this._createRouteInfo(toRoute, toParams, path, targetLocale);

      // EJECUTAR BEFORE EACH GUARD
      const guardResult = await this._executeBeforeEachGuard(to, from);

      // Si el guard redirige
      if (guardResult && guardResult.path) {
         // A guard redirect stays in the language the user was going to.
         const redirectOptions = { ...(guardResult.options || {}) };
         if (targetLocale && !redirectOptions.locale) redirectOptions.locale = targetLocale;
         return this._navigateWithGuards(guardResult.path, redirectOptions, [...redirectChain, path]);
      }

      // Si el guard cancela la navegación (next(false))
      if (guardResult && guardResult.path === false) {
         slice.logger.logInfo('Router', 'Navigation cancelled by guard');
         return;
      }

      // No hay redirección - continuar con la navegación normal
      // Usar replace o push según las opciones
      if (options.replace) {
         window.history.replaceState({}, path, window.location.origin + to.url);
      } else {
         window.history.pushState({}, path, window.location.origin + to.url);
      }

      // Without routing the locale is not in the URL: switch it here. With routing,
      // onRouteChange() follows the URL (dictionaries are already loaded).
      if (targetLocale && !translator?.routing && targetLocale !== translator.locale) {
         await translator.setLocale(targetLocale);
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
      if (this.routeChangeTimeout) {
         clearTimeout(this.routeChangeTimeout);
         // This call supersedes a still-pending one; resolve the superseded
         // promise so anything awaiting it doesn't hang — the new call does the
         // real work.
         if (this._routeChangeResolve) {
            this._routeChangeResolve();
            this._routeChangeResolve = null;
         }
      }

      // Resolve only AFTER the debounced route handling finishes, so a caller
      // that awaits this (e.g. _performNavigation) sees slice.router.activeRoute
      // already updated before it emits router:change. (Previously the awaited
      // promise resolved the instant the timer was scheduled, so router:change
      // fired ~10ms before activeRoute was set.)
      return new Promise((resolve) => {
         this._routeChangeResolve = resolve;
         this.routeChangeTimeout = setTimeout(async () => {
            try {
               await this._followUrlLocale();
               const path = this.path;
               const routeContainersFlag = await this.renderRoutesComponentsInPage();

               if (routeContainersFlag) {
                  return;
               }

               const { route, params } = this.matchRoute(path);
               if (route) {
                  await this.handleRoute(route, params);
               }
            } catch (error) {
               slice.logger.error('Router', `Route change failed for ${window.location.pathname}`, error);
            } finally {
               this._routeChangeResolve = null;
               resolve();
            }
         }, 10);
      });
   }

   /**
    * With `routing`, the URL decides the locale: back/forward from `/en/x` to `/x`, or a
    * navigation to another language, switches it before the route renders. An URL without
    * the prefix "prefix" requires gets it (replaceState).
    * @returns {Promise<void>}
    */
   async _followUrlLocale() {
      const translator = slice.translator;
      if (!translator?.routing) return;
      const urlLocale = translator.localeOfUrl(window.location.pathname);
      if (urlLocale && urlLocale !== translator.locale) {
         try {
            await translator.setLocale(urlLocale);
         } catch (error) {
            slice.logger.logError('Router', `Could not switch to "${urlLocale}" from the URL`, error);
         }
      }
      translator.syncUrl();
   }

   /**
    * Write a route's metadata (title, description) to the document. `{ "t": "key" }`
    * fields are translated with slice.translator.
    * @param {Object|null} metadata
    * @returns {void}
    */
   applyMetadata(metadata) {
      applyRouteMetadata(metadata);
   }

   /**
    * Build or update the active route component.
    * @param {RouteConfig} route
    * @param {Object} params
    * @returns {Promise<void>}
    */
   async handleRoute(route, params) {
      // Titles are on by default: without this, a SPA keeps the first page's
      // title while the user navigates. `sliceConfig.router.updateTitles: false`
      // opts out; a `router:change` listener still wins, because this runs
      // before the event.
      // Kept so slice.translator can re-apply it (translated) after a locale change.
      this.activeMetadata = route?.metadata ?? null;
      if (slice.routerConfig?.updateTitles !== false) {
         this.applyMetadata(this.activeMetadata);
      }

      const targetElement = document.querySelector('#app');

      const componentName = route.parentRoute ? route.parentRoute.component : route.component;
      const sliceId = `route-${componentName}`;

      if (!targetElement) {
         slice.logger.logError('Router', `Cannot render route "${route?.path ?? componentName}": no #app element in the document`);
         return;
      }

      const existingComponent = slice.controller.getComponent(sliceId);

      if (slice.loading) {
         slice.loading.start();
      }

      try {
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

            // build() returns null whenever the component could not be produced
            // (not registered, a resource fetch failed or was aborted, init()
            // threw). Appending null raises "parameter 1 is not of type 'Node'",
            // which buries the real cause. Report it and keep the current view.
            if (!component) {
               slice.logger.logError(
                  'Router',
                  `Cannot render route "${route?.path ?? componentName}": slice.build('${componentName}') returned null`
               );
               return;
            }

            targetElement.innerHTML = '';
            targetElement.appendChild(component);

            await this.renderRoutesInComponent(component);
         }

         // Invalidar caché después de cambios importantes en el DOM
         this.invalidateCache();
         slice.router.activeRoute = route;
      } finally {
         if (slice.loading) {
            slice.loading.stop();
         }
      }
   }

   /**
    * Load initial route and run guards.
    * @returns {Promise<void>}
    */
   async loadInitialRoute() {
      const path = this.path;
      const { route, params } = this.matchRoute(path);

      // Para la carga inicial, también ejecutar guards
      const from = this._createRouteInfo(null, {}, null);
      const to = this._createRouteInfo(route, params, path);

      // EJECUTAR BEFORE EACH GUARD en carga inicial
      const guardResult = await this._executeBeforeEachGuard(to, from);

      if (guardResult && guardResult.path) {
         return this.navigate(guardResult.path, guardResult.options || {});
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
            try {
               let shouldInvalidateCache = false;

               mutations.forEach((mutation) => {
                  if (mutation.type === 'childList') {
                     const addedNodes = Array.from(mutation.addedNodes || []);
                     const removedNodes = Array.from(mutation.removedNodes || []);

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
            } catch (error) {
               slice.logger.error('Router', 'Error in MutationObserver callback', error);
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

         // Compile parameterized patterns once at map-build time instead of on every
         // navigation. Static routes leave `compiled` undefined.
         if (fullPath.includes('${')) {
            routeWithParent.compiled = this.compilePathPattern(fullPath);
         }

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
            const containerName = routeContainer?.tagName || routeContainer?.constructor?.name || 'unknown';
            slice.logger.error('Router', `Error rendering route container "${containerName}"`, error);
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
      // Routes are declared without locale: drop a known prefix ('/en/about' -> '/about'),
      // and the query / hash, which never take part in matching.
      path = this._appPath(String(path || '/')).split(/[?#]/)[0] || '/';
      // Normalize a trailing slash ('/about/' -> '/about'); keep root '/' as-is.
      path = path.length > 1 ? path.replace(/\/+$/, '') : path;
      // Exact match first (fast path), then a case-insensitive match on static paths
      // so '/About' resolves to a route declared as '/about'.
      let exactMatch = this.pathToRouteMap.get(path);
      if (!exactMatch) {
         exactMatch = this._staticLowerIndex.get(path.toLowerCase());
      }
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

      for (const route of this.pathToRouteMap.values()) {
         if (route.compiled) {
            const { regex, paramNames } = route.compiled;
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

      // 'i' flag: paths match case-insensitively. Captured param values keep their original case.
      return { regex: new RegExp(regexPattern, 'i'), paramNames };
   }
}
