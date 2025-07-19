// Slice/Components/Structural/Router/RouteRenderer.js

/**
 * Sistema de renderizado de rutas optimizado
 * Maneja la lógica de renderizado y gestión de componentes
 */
export default class RouteRenderer {
   constructor(routeCache) {
      this.routeCache = routeCache;
      this.activeComponents = new Map();
      this.componentPool = new Map();
      this.renderQueue = new Set();
      
      // Configuración de pool de componentes
      this.maxPoolSize = 5;
      this.componentCleanupDelay = 30000; // 30 segundos
   }

   /**
    * Renderizar rutas en página con optimizaciones
    */
   async renderRoutesComponentsInPage(searchContainer = document) {
      let routerContainersFlag = false;
      const routeContainers = this.routeCache.getCachedRouteContainers(searchContainer);

      // Usar Promise.allSettled para renderizado paralelo
      const renderPromises = routeContainers.map(async (routeContainer) => {
         try {
            // Verificar que el componente aún esté conectado al DOM
            if (!routeContainer.isConnected) {
               this.routeCache.invalidateContainer(searchContainer);
               return false;
            }

            // Evitar renderizado duplicado
            const containerId = this.getContainerId(routeContainer);
            if (this.renderQueue.has(containerId)) {
               return false;
            }

            this.renderQueue.add(containerId);
            
            try {
               const response = await routeContainer.renderIfCurrentRoute();
               if (response) {
                  routerContainersFlag = true;
                  return response;
               }
            } finally {
               this.renderQueue.delete(containerId);
            }
            
            return false;
         } catch (error) {
            slice.logger.logError('RouteRenderer', `Error rendering route container`, error);
            return false;
         }
      });

      await Promise.allSettled(renderPromises);
      return routerContainersFlag;
   }

   /**
    * Renderizar rutas dentro de un componente específico
    */
   async renderRoutesInComponent(component) {
      if (!component) {
         slice.logger.logWarning('RouteRenderer', 'No component provided for route rendering');
         return false;
      }

      return await this.renderRoutesComponentsInPage(component);
   }

   /**
    * Manejar renderizado de ruta con pool de componentes
    */
   async handleRoute(route, params) {
      const targetElement = document.querySelector('#app');
      
      if (!targetElement) {
         slice.logger.logError('RouteRenderer', 'Target element #app not found');
         return;
      }

      const componentName = route.parentRoute ? 
         route.parentRoute.component : route.component;
      const sliceId = `route-${componentName}`;
      
      // Mostrar loading si está disponible
      if (slice.loading) {
         slice.loading.start();
      }

      try {
         // Intentar reutilizar componente existente
         let component = await this.getOrCreateComponent(componentName, sliceId, params);
         
         if (!component) {
            slice.logger.logError('RouteRenderer', `Failed to create component ${componentName}`);
            return;
         }

         // Limpiar y renderizar
         await this.renderComponent(targetElement, component);
         
         // Renderizar rutas anidadas después de insertar
         await this.renderRoutesInComponent(component);
         
         // Actualizar ruta activa
         slice.router.activeRoute = route;

      } catch (error) {
         slice.logger.logError('RouteRenderer', `Error handling route ${route.path}`, error);
      } finally {
         // Ocultar loading
         if (slice.loading) {
            slice.loading.stop();
         }
      }
   }

   /**
    * Obtener o crear componente con pool
    */
   async getOrCreateComponent(componentName, sliceId, params) {
      // Verificar si ya existe
      const existingComponent = slice.controller.getComponent(sliceId);
      
      if (existingComponent && existingComponent.isConnected) {
         // Actualizar props si es necesario
         if (existingComponent.update) {
            existingComponent.props = { ...existingComponent.props, ...params };
            await existingComponent.update();
         }
         return existingComponent;
      }

      // Intentar obtener del pool
      const pooledComponent = this.getFromPool(componentName);
      if (pooledComponent) {
         pooledComponent.sliceId = sliceId;
         pooledComponent.props = { ...pooledComponent.props, ...params };
         
         if (pooledComponent.update) {
            await pooledComponent.update();
         }
         
         return pooledComponent;
      }

      // Crear nuevo componente
      const component = await slice.build(componentName, {
         params,
         sliceId: sliceId,
      });

      return component;
   }

   /**
    * Renderizar componente en el elemento objetivo
    */
   async renderComponent(targetElement, component) {
      // Guardar componente anterior para pool
      const previousComponent = targetElement.firstElementChild;
      if (previousComponent && previousComponent !== component) {
         this.addToPool(previousComponent);
      }

      // Usar DocumentFragment para renderizado más eficiente
      const fragment = document.createDocumentFragment();
      fragment.appendChild(component);
      
      // Limpiar y insertar
      targetElement.innerHTML = '';
      targetElement.appendChild(fragment);
      
      // Registrar componente activo
      this.activeComponents.set(component.sliceId || 'anonymous', component);
   }

   /**
    * Obtener componente del pool
    */
   getFromPool(componentName) {
      const pool = this.componentPool.get(componentName);
      if (pool && pool.length > 0) {
         return pool.pop();
      }
      return null;
   }

   /**
    * Añadir componente al pool
    */
   addToPool(component) {
      if (!component || !component.tagName) return;
      
      const componentName = component.tagName.toLowerCase();
      
      if (!this.componentPool.has(componentName)) {
         this.componentPool.set(componentName, []);
      }
      
      const pool = this.componentPool.get(componentName);
      
      // Limitar tamaño del pool
      if (pool.length < this.maxPoolSize) {
         // Limpiar el componente antes de añadirlo al pool
         this.cleanupComponent(component);
         pool.push(component);
         
         // Programar cleanup automático
         this.scheduleComponentCleanup(componentName, component);
      }
   }

   /**
    * Limpiar componente para reutilización
    */
   cleanupComponent(component) {
      // Remover event listeners específicos del contexto anterior
      if (component.cleanup) {
         component.cleanup();
      }
      
      // Resetear propiedades específicas
      if (component.props) {
         component.props = {};
      }
      
      // Remover del DOM si está conectado
      if (component.isConnected) {
         component.remove();
      }
   }

   /**
    * Programar cleanup automático de componentes del pool
    */
   scheduleComponentCleanup(componentName, component) {
      setTimeout(() => {
         const pool = this.componentPool.get(componentName);
         if (pool) {
            const index = pool.indexOf(component);
            if (index > -1) {
               pool.splice(index, 1);
               
               // Cleanup final del componente
               this.destroyComponent(component);
            }
         }
      }, this.componentCleanupDelay);
   }

   /**
    * Destruir componente completamente
    */
   destroyComponent(component) {
      if (component.destroy) {
         component.destroy();
      }
      
      // Remover referencias
      this.activeComponents.delete(component.sliceId);
   }

   /**
    * Obtener ID único del contenedor
    */
   getContainerId(container) {
      return container.sliceId || 
             container.id || 
             `${container.tagName}-${Math.random().toString(36).substr(2, 9)}`;
   }

   /**
    * Limpiar pool de componentes
    */
   clearPool(componentName = null) {
      if (componentName) {
         const pool = this.componentPool.get(componentName);
         if (pool) {
            pool.forEach(component => this.destroyComponent(component));
            this.componentPool.delete(componentName);
         }
      } else {
         // Limpiar todo el pool
         for (const [name, pool] of this.componentPool.entries()) {
            pool.forEach(component => this.destroyComponent(component));
         }
         this.componentPool.clear();
      }
   }

   /**
    * Obtener estadísticas del renderer
    */
   getStats() {
      const poolStats = {};
      for (const [name, pool] of this.componentPool.entries()) {
         poolStats[name] = pool.length;
      }
      
      return {
         activeComponents: this.activeComponents.size,
         renderQueue: this.renderQueue.size,
         componentPool: poolStats,
         totalPooledComponents: Array.from(this.componentPool.values())
            .reduce((total, pool) => total + pool.length, 0)
      };
   }

   /**
    * Destruir el renderer y cleanup
    */
   destroy() {
      this.clearPool();
      this.activeComponents.clear();
      this.renderQueue.clear();
   }
}