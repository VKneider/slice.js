// Slice/Components/Structural/Router/Router.js

import EventThrottler from './EventThrottler.js';
import RouteCache from './RouteCache.js';
import RouteMatcher from './RouteMatcher.js';
import RouteRenderer from './RouteRenderer.js';

/**
 * Router optimizado con separación de responsabilidades
 * Mejoras significativas en performance y mantenibilidad
 */
export default class Router {
   constructor(routes) {
      this.routes = routes;
      this.activeRoute = null;
      
      // Inicializar sistemas especializados
      this.eventThrottler = new EventThrottler();
      this.routeCache = new RouteCache();
      this.routeMatcher = new RouteMatcher(routes);
      this.routeRenderer = new RouteRenderer(this.routeCache);
      
      // Observer para cambios DOM
      this.mutationObserver = null;
      
      // Estado del router
      this.isInitialized = false;
      this.isNavigating = false;
   }

   /**
    * Inicializar router con observadores optimizados
    */
   async init() {
      if (this.isInitialized) {
         slice.logger.logWarning('Router', 'Router already initialized');
         return;
      }

      try {
         // Configurar observador de mutaciones optimizado
         this.setupMutationObserver();
         
         // Cargar ruta inicial
         await this.loadInitialRoute();
         
         // Configurar listeners de navegación
         this.setupNavigationListeners();
         
         this.isInitialized = true;
         slice.logger.logInfo('Router', 'Router initialized successfully');
         
      } catch (error) {
         slice.logger.logError('Router', 'Error initializing router', error);
         throw error;
      }
   }

   /**
    * Configurar observador de mutaciones optimizado
    */
   setupMutationObserver() {
      if (typeof MutationObserver === 'undefined') {
         slice.logger.logWarning('Router', 'MutationObserver not available');
         return;
      }

      this.mutationObserver = new MutationObserver((mutations) => {
         // Usar throttling para evitar múltiples invalidaciones
         this.eventThrottler.throttle('cache-invalidation', () => {
            this.routeCache.invalidateByMutation(mutations);
         }, 50);
      });
      
      this.mutationObserver.observe(document.body, {
         childList: true,
         subtree: true,
         attributeFilter: ['slice-route', 'slice-multi-route']
      });
   }

   /**
    * Configurar listeners de navegación
    */
   setupNavigationListeners() {
      // Listener para popstate (back/forward)
      window.addEventListener('popstate', (event) => {
         this.eventThrottler.throttle('popstate', () => {
            return this.onRouteChange();
         });
      });

      // Interceptación automática de enlaces (activada por defecto)
      // Para desactivar: agregar disableAutoInterceptLinks: true en la configuración
      if (!this.routes.disableAutoInterceptLinks) {
         this.setupLinkInterception();
         slice.logger.logInfo('Router', 'Auto link interception enabled');
      }
   }

   /**
    * Configurar interceptación de enlaces
    * Convierte todos los <a href="/path"> en slice.router.navigate()
    */
   setupLinkInterception() {
      document.addEventListener('click', (event) => {
         const link = event.target.closest('a[href]');
         if (link && this.shouldInterceptLink(link)) {
            event.preventDefault();
            
            const href = link.getAttribute('href');
            slice.logger.logInfo('Router', `Intercepting link: ${href}`);
            
            this.navigate(href);
         }
      });
   }

   /**
    * Verificar si debe interceptar el enlace
    */
   shouldInterceptLink(link) {
      const href = link.getAttribute('href');
      
      // No interceptar si no hay href
      if (!href) return false;
      
      // No interceptar enlaces externos (diferentes dominio)
      if (href.startsWith('http://') || href.startsWith('https://')) {
         const linkUrl = new URL(href, window.location.origin);
         if (linkUrl.origin !== window.location.origin) {
            return false;
         }
      }
      
      // No interceptar protocolos especiales
      if (href.startsWith('mailto:') || 
          href.startsWith('tel:') ||
          href.startsWith('sms:') ||
          href.startsWith('ftp:')) {
         return false;
      }
      
      // No interceptar anchors (#hash)
      if (href.startsWith('#')) {
         return false;
      }
      
      // No interceptar si tiene atributos especiales
      if (link.hasAttribute('download') ||
          link.target === '_blank' ||
          link.target === '_top' ||
          link.target === '_parent' ||
          link.hasAttribute('data-no-intercept') ||
          link.hasAttribute('data-external')) {
         return false;
      }
      
      // No interceptar si está marcado como externo
      if (link.classList.contains('external-link') ||
          link.classList.contains('no-intercept')) {
         return false;
      }
      
      return true;
   }

   /**
    * Manejar cambio de ruta con throttling optimizado
    */
   async onRouteChange() {
      if (this.isNavigating) {
         return;
      }

      return this.eventThrottler.throttle('route-change', async () => {
         this.isNavigating = true;
         
         try {
            const path = window.location.pathname;
            
            // Intentar renderizar rutas en componentes existentes primero
            const routeContainersFlag = await this.routeRenderer.renderRoutesComponentsInPage();

            if (routeContainersFlag) {
               return;
            }

            // Si no hay contenedores de rutas, hacer matching tradicional
            const { route, params } = this.routeMatcher.matchRoute(path);
            if (route) {
               await this.routeRenderer.handleRoute(route, params);
            }
            
         } catch (error) {
            slice.logger.logError('Router', 'Error during route change', error);
         } finally {
            this.isNavigating = false;
         }
      }, 10);
   }

   /**
    * Navegar a una ruta específica
    */
   async navigate(path, options = {}) {
      if (!path || path === window.location.pathname) {
         return;
      }

      try {
         const { replace = false, state = {} } = options;
         
         // Actualizar historia del navegador
         if (replace) {
            window.history.replaceState(state, '', window.location.origin + path);
         } else {
            window.history.pushState(state, '', window.location.origin + path);
         }
         
         // Ejecutar cambio de ruta
         await this.onRouteChange();
         
      } catch (error) {
         slice.logger.logError('Router', `Error navigating to ${path}`, error);
      }
   }

   /**
    * Navegar hacia atrás
    */
   back() {
      window.history.back();
   }

   /**
    * Navegar hacia adelante
    */
   forward() {
      window.history.forward();
   }

   /**
    * Cargar ruta inicial
    */
   async loadInitialRoute() {
      const path = window.location.pathname;
      const { route, params } = this.routeMatcher.matchRoute(path);

      if (route) {
         await this.routeRenderer.handleRoute(route, params);
      } else {
         slice.logger.logWarning('Router', `No route found for initial path: ${path}`);
      }
   }

   /**
    * Métodos de conveniencia para acceso a subsistemas
    */
   
   // Acceso al matcher
   matchRoute(path) {
      return this.routeMatcher.matchRoute(path);
   }

   hasRoute(path) {
      return this.routeMatcher.hasRoute(path);
   }

   generateUrl(routePath, params) {
      return this.routeMatcher.generateUrl(routePath, params);
   }

   // Acceso al caché
   invalidateCache() {
      this.routeCache.invalidateAll();
   }

   getCacheStats() {
      return this.routeCache.getStats();
   }

   // Acceso al renderer
   async renderRoutesInComponent(component) {
      return this.routeRenderer.renderRoutesInComponent(component);
   }

   getRendererStats() {
      return this.routeRenderer.getStats();
   }

   /**
    * Actualizar rutas dinámicamente
    */
   updateRoutes(newRoutes) {
      this.routes = newRoutes;
      this.routeMatcher.updateRoutes(newRoutes);
      this.invalidateCache();
   }

   /**
    * Añadir ruta individual
    */
   addRoute(route, basePath = '') {
      this.routeMatcher.addRoute(route, basePath);
      this.invalidateCache();
   }

   /**
    * Remover ruta
    */
   removeRoute(path) {
      this.routeMatcher.removeRoute(path);
      this.invalidateCache();
   }

   /**
    * Obtener todas las rutas
    */
   getAllRoutes() {
      return this.routeMatcher.getAllRoutes();
   }

   /**
    * Obtener estadísticas completas del router
    */
   getStats() {
      return {
         isInitialized: this.isInitialized,
         isNavigating: this.isNavigating,
         activeRoute: this.activeRoute,
         matcher: this.routeMatcher.getStats(),
         cache: this.routeCache.getStats(),
         renderer: this.routeRenderer.getStats(),
         eventThrottler: {
            pendingEvents: this.eventThrottler.timeouts.size
         }
      };
   }

   /**
    * Destruir router y cleanup
    */
   destroy() {
      // Detener observadores
      if (this.mutationObserver) {
         this.mutationObserver.disconnect();
         this.mutationObserver = null;
      }

      // Cancelar eventos pendientes
      this.eventThrottler.destroy();

      // Limpiar subsistemas
      this.routeCache.destroy();
      this.routeRenderer.destroy();

      // Remover listeners
      window.removeEventListener('popstate', this.onRouteChange);

      this.isInitialized = false;
      
      slice.logger.logInfo('Router', 'Router destroyed successfully');
   }

   /**
    * Reinicializar router (útil para testing)
    */
   async reinitialize(newRoutes = null) {
      this.destroy();
      
      if (newRoutes) {
         this.routes = newRoutes;
         this.routeMatcher = new RouteMatcher(newRoutes);
         this.routeRenderer = new RouteRenderer(this.routeCache);
      }
      
      await this.init();
   }
}