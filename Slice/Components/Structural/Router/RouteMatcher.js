// Slice/Components/Structural/Router/RouteMatcher.js

/**
 * Sistema de matching de rutas optimizado
 * Separa la lógica de matching del Router principal
 */
export default class RouteMatcher {
   constructor(routes) {
      this.routes = routes;
      this.pathToRouteMap = new Map();
      this.compiledPatterns = new Map();
      this.staticRoutes = new Map();
      this.dynamicRoutes = new Map();
      
      this.buildOptimizedMaps();
   }

   /**
    * Construir mapas optimizados para matching rápido
    */
   buildOptimizedMaps() {
      this.pathToRouteMap = this.createPathToRouteMap(this.routes);
      
      // Separar rutas estáticas de dinámicas para matching más rápido
      for (const [path, route] of this.pathToRouteMap.entries()) {
         if (path.includes('${')) {
            // Ruta dinámica - pre-compilar el patrón
            const compiled = this.compilePathPattern(path);
            this.compiledPatterns.set(path, compiled);
            this.dynamicRoutes.set(path, route);
         } else {
            // Ruta estática - acceso directo
            this.staticRoutes.set(path, route);
         }
      }
   }

   /**
    * Crear mapa de rutas con optimizaciones
    */
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

   /**
    * Matching optimizado con separación de rutas estáticas/dinámicas
    */
   matchRoute(path) {
      // 1. Buscar primero en rutas estáticas (más rápido)
      const staticMatch = this.staticRoutes.get(path);
      if (staticMatch) {
         return this.formatMatchResult(staticMatch, {});
      }

      // 2. Buscar en rutas dinámicas solo si no hay match estático
      for (const [routePattern, route] of this.dynamicRoutes.entries()) {
         const compiled = this.compiledPatterns.get(routePattern);
         const match = path.match(compiled.regex);
         
         if (match) {
            const params = {};
            compiled.paramNames.forEach((name, i) => {
               params[name] = match[i + 1];
            });
            
            return this.formatMatchResult(route, params);
         }
      }

      // 3. Ruta 404 si no hay matches
      const notFoundRoute = this.staticRoutes.get('/404');
      return this.formatMatchResult(notFoundRoute, {});
   }

   /**
    * Formatear resultado del match consistentemente
    */
   formatMatchResult(route, params) {
      if (!route) {
         return { route: null, params: {} };
      }

      if (route.parentRoute) {
         return { 
            route: route.parentRoute, 
            params: params,
            childRoute: route
         };
      }
      
      return { route, params };
   }

   /**
    * Compilar patrón de ruta con caché
    */
   compilePathPattern(pattern) {
      // Verificar si ya está compilado
      if (this.compiledPatterns.has(pattern)) {
         return this.compiledPatterns.get(pattern);
      }

      const paramNames = [];
      const regexPattern = '^' + pattern.replace(/\$\{([^}]+)\}/g, (_, paramName) => {
         paramNames.push(paramName);
         return '([^/]+)';
      }) + '$';

      const compiled = { 
         regex: new RegExp(regexPattern), 
         paramNames 
      };

      this.compiledPatterns.set(pattern, compiled);
      return compiled;
   }

   /**
    * Obtener todas las rutas disponibles
    */
   getAllRoutes() {
      return Array.from(this.pathToRouteMap.values());
   }

   /**
    * Obtener rutas por componente
    */
   getRoutesByComponent(componentName) {
      return Array.from(this.pathToRouteMap.values())
         .filter(route => route.component === componentName);
   }

   /**
    * Verificar si una ruta existe
    */
   hasRoute(path) {
      return this.staticRoutes.has(path) || 
             Array.from(this.dynamicRoutes.keys()).some(pattern => {
                const compiled = this.compiledPatterns.get(pattern);
                return compiled.regex.test(path);
             });
   }

   /**
    * Generar URL con parámetros
    */
   generateUrl(routePath, params = {}) {
      if (!routePath.includes('${')) {
         return routePath;
      }

      return routePath.replace(/\$\{([^}]+)\}/g, (_, paramName) => {
         return params[paramName] || paramName;
      });
   }

   /**
    * Actualizar rutas dinámicamente
    */
   updateRoutes(newRoutes) {
      this.routes = newRoutes;
      this.pathToRouteMap.clear();
      this.compiledPatterns.clear();
      this.staticRoutes.clear();
      this.dynamicRoutes.clear();
      
      this.buildOptimizedMaps();
   }

   /**
    * Añadir ruta individual
    */
   addRoute(route, basePath = '') {
      const fullPath = `${basePath}${route.path}`.replace(/\/+/g, '/');
      const routeWithPath = { ...route, fullPath };
      
      this.pathToRouteMap.set(fullPath, routeWithPath);
      
      if (fullPath.includes('${')) {
         const compiled = this.compilePathPattern(fullPath);
         this.compiledPatterns.set(fullPath, compiled);
         this.dynamicRoutes.set(fullPath, routeWithPath);
      } else {
         this.staticRoutes.set(fullPath, routeWithPath);
      }
   }

   /**
    * Remover ruta
    */
   removeRoute(path) {
      this.pathToRouteMap.delete(path);
      this.staticRoutes.delete(path);
      this.dynamicRoutes.delete(path);
      this.compiledPatterns.delete(path);
   }

   /**
    * Obtener estadísticas del matcher
    */
   getStats() {
      return {
         totalRoutes: this.pathToRouteMap.size,
         staticRoutes: this.staticRoutes.size,
         dynamicRoutes: this.dynamicRoutes.size,
         compiledPatterns: this.compiledPatterns.size
      };
   }
}