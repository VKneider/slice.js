// Slice/Components/Structural/Router/RouteCache.js

/**
 * Sistema de caché optimizado para contenedores de rutas
 * Caché individual por contenedor con timestamps y cleanup automático
 */
export default class RouteCache {
   constructor() {
      this.containerCaches = new Map();
      this.CACHE_DURATION = 100; // ms
      this.processedContainers = new WeakMap();
      this.cleanupInterval = null;
      
      // Auto-cleanup cada 5 segundos
      this.startCleanupScheduler();
   }

   /**
    * Obtener contenedores de rutas con caché inteligente
    */
   getCachedRouteContainers(container) {
      const containerKey = this.getContainerKey(container);
      const now = Date.now();
      
      // Verificar caché individual por contenedor
      if (this.containerCaches.has(containerKey)) {
         const cached = this.containerCaches.get(containerKey);
         
         // Verificar si el caché es válido y el contenedor sigue conectado
         if ((now - cached.timestamp) < this.CACHE_DURATION && 
             this.isContainerValid(container, cached.containers)) {
            return cached.containers;
         }
      }

      // Regenerar caché para este contenedor específico
      const routeContainers = this.findAllRouteContainersOptimized(container);
      this.containerCaches.set(containerKey, {
         containers: routeContainers,
         timestamp: now,
         containerRef: new WeakRef(container)
      });
      
      return routeContainers;
   }

   /**
    * Búsqueda optimizada con WeakMap para evitar recorridos repetidos
    */
   findAllRouteContainersOptimized(container) {
      // Si ya procesamos este contenedor recientemente, usar WeakMap
      if (this.processedContainers.has(container)) {
         const cached = this.processedContainers.get(container);
         if (Date.now() - cached.timestamp < 50) { // Cache ultra corto para WeakMap
            return cached.containers.filter(c => c.isConnected);
         }
      }

      const routeContainers = [];
      
      // TreeWalker optimizado con filtro más específico
      const walker = document.createTreeWalker(
         container,
         NodeFilter.SHOW_ELEMENT,
         {
            acceptNode: (node) => {
               // Filtro más eficiente
               const tagName = node.tagName;
               if (tagName === 'SLICE-ROUTE' || tagName === 'SLICE-MULTI-ROUTE') {
                  // Verificar que esté conectado y visible
                  if (node.isConnected && !node.hasAttribute('disabled')) {
                     return NodeFilter.FILTER_ACCEPT;
                  }
               }
               return NodeFilter.FILTER_SKIP;
            }
         }
      );

      let node;
      while (node = walker.nextNode()) {
         routeContainers.push(node);
      }

      // Guardar en WeakMap para acceso ultra-rápido
      this.processedContainers.set(container, {
         containers: routeContainers,
         timestamp: Date.now()
      });

      return routeContainers;
   }

   /**
    * Generar clave única para contenedor
    */
   getContainerKey(container) {
      if (container === document) {
         return 'document';
      }
      
      // Usar sliceId si existe, si no, crear una clave basada en posición
      return container.sliceId || 
             container.id || 
             `${container.tagName}-${this.getElementIndex(container)}`;
   }

   /**
    * Obtener índice del elemento para identificación única
    */
   getElementIndex(element) {
      if (!element.parentNode) return 0;
      
      const siblings = Array.from(element.parentNode.children);
      return siblings.indexOf(element);
   }

   /**
    * Verificar si los contenedores en caché siguen siendo válidos
    */
   isContainerValid(container, cachedContainers) {
      // Verificar que el contenedor principal siga conectado
      if (!container.isConnected) {
         return false;
      }

      // Verificar que al menos el 80% de los contenedores cached siguen conectados
      const connectedCount = cachedContainers.filter(c => c.isConnected).length;
      const validityThreshold = Math.max(1, Math.floor(cachedContainers.length * 0.8));
      
      return connectedCount >= validityThreshold;
   }

   /**
    * Invalidar caché específico de un contenedor
    */
   invalidateContainer(container) {
      const containerKey = this.getContainerKey(container);
      this.containerCaches.delete(containerKey);
      
      if (this.processedContainers.has(container)) {
         this.processedContainers.delete(container);
      }
   }

   /**
    * Invalidar todo el caché
    */
   invalidateAll() {
      this.containerCaches.clear();
      // No podemos limpiar WeakMap directamente, pero se limpiará automáticamente
   }

   /**
    * Invalidar caché selectivo basado en cambios DOM
    */
   invalidateByMutation(mutations) {
      const affectedContainers = new Set();
      
      mutations.forEach((mutation) => {
         if (mutation.type === 'childList') {
            const addedNodes = Array.from(mutation.addedNodes);
            const removedNodes = Array.from(mutation.removedNodes);
            
            // Buscar contenedores afectados
            [...addedNodes, ...removedNodes].forEach(node => {
               if (node.nodeType === Node.ELEMENT_NODE) {
                  if (node.tagName === 'SLICE-ROUTE' || node.tagName === 'SLICE-MULTI-ROUTE') {
                     affectedContainers.add(mutation.target);
                  }
                  
                  // Buscar contenedores padre que podrían estar afectados
                  let parent = mutation.target;
                  while (parent && parent !== document) {
                     if (parent.tagName && (
                         parent.tagName.includes('SLICE') || 
                         parent.hasAttribute('slice-component'))) {
                        affectedContainers.add(parent);
                     }
                     parent = parent.parentElement;
                  }
               }
            });
         }
      });

      // Invalidar solo los contenedores afectados
      affectedContainers.forEach(container => {
         this.invalidateContainer(container);
      });
   }

   /**
    * Cleanup automático de cachés obsoletos
    */
   startCleanupScheduler() {
      this.cleanupInterval = setInterval(() => {
         this.cleanupStaleCache();
      }, 5000); // Cada 5 segundos
   }

   /**
    * Limpiar caché obsoleto
    */
   cleanupStaleCache() {
      const now = Date.now();
      const maxAge = this.CACHE_DURATION * 10; // 10x la duración normal para cleanup
      
      for (const [key, cached] of this.containerCaches.entries()) {
         // Eliminar cachés muy antiguos
         if ((now - cached.timestamp) > maxAge) {
            this.containerCaches.delete(key);
            continue;
         }
         
         // Eliminar cachés de contenedores que ya no existen
         if (cached.containerRef && !cached.containerRef.deref()) {
            this.containerCaches.delete(key);
         }
      }
   }

   /**
    * Obtener estadísticas del caché para debugging
    */
   getStats() {
      return {
         totalCaches: this.containerCaches.size,
         oldestCache: Math.min(...Array.from(this.containerCaches.values()).map(c => c.timestamp)),
         newestCache: Math.max(...Array.from(this.containerCaches.values()).map(c => c.timestamp))
      };
   }

   /**
    * Destruir el caché y cleanup
    */
   destroy() {
      if (this.cleanupInterval) {
         clearInterval(this.cleanupInterval);
         this.cleanupInterval = null;
      }
      
      this.invalidateAll();
   }
}