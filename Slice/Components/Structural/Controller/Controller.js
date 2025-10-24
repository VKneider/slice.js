import components from '/Components/components.js';

export default class Controller {
   constructor() {
      this.componentCategories = new Map(Object.entries(components));
      this.templates = new Map();
      this.classes = new Map();
      this.requestedStyles = new Set(); // ✅ CRÍTICO: Para tracking de CSS cargados
      this.activeComponents = new Map();
      
      // 🚀 OPTIMIZACIÓN: Índice inverso para búsqueda rápida de hijos
      // parentSliceId → Set<childSliceId>
      this.childrenIndex = new Map();
      
      this.idCounter = 0;
   }

   logActiveComponents() {
      this.activeComponents.forEach((component) => {
         let parent = component.parentComponent;
         let parentName = parent ? parent.constructor.name : null;
      });
   }

   getTopParentsLinkedToActiveComponents() {
      let topParentsLinkedToActiveComponents = new Map();
      this.activeComponents.forEach((component) => {
         let parent = component.parentComponent;
         while (parent && parent.parentComponent) {
            parent = parent.parentComponent;
         }
         if (!topParentsLinkedToActiveComponents.has(parent)) {
            topParentsLinkedToActiveComponents.set(parent, []);
         }
         topParentsLinkedToActiveComponents.get(parent).push(component);
      });
      return topParentsLinkedToActiveComponents;
   }

   verifyComponentIds(component) {
      const htmlId = component.id;

      if (htmlId && htmlId.trim() !== '') {
         if (this.activeComponents.has(htmlId)) {
            slice.logger.logError(
               'Controller',
               `A component with the same html id attribute is already registered: ${htmlId}`
            );
            return false;
         }
      }

      let sliceId = component.sliceId;

      if (sliceId && sliceId.trim() !== '') {
         if (this.activeComponents.has(sliceId)) {
            slice.logger.logError(
               'Controller',
               `A component with the same slice id attribute is already registered: ${sliceId}`
            );
            return false;
         }
      } else {
         sliceId = `${component.constructor.name[0].toLowerCase()}${component.constructor.name.slice(1)}-${this.idCounter}`;
         component.sliceId = sliceId;
         this.idCounter++;
      }

      component.sliceId = sliceId;
      return true;
   }

   /**
    * Registra un componente y actualiza el índice de relaciones padre-hijo
    * 🚀 OPTIMIZADO: Ahora mantiene childrenIndex y precalcula profundidad
    */
   registerComponent(component, parent = null) {
      component.parentComponent = parent;
      
      // 🚀 OPTIMIZACIÓN: Precalcular y guardar profundidad
      component._depth = parent ? (parent._depth || 0) + 1 : 0;
      
      // Registrar en activeComponents
      this.activeComponents.set(component.sliceId, component);
      
      // 🚀 OPTIMIZACIÓN: Actualizar índice inverso de hijos
      if (parent) {
         if (!this.childrenIndex.has(parent.sliceId)) {
            this.childrenIndex.set(parent.sliceId, new Set());
         }
         this.childrenIndex.get(parent.sliceId).add(component.sliceId);
      }
      
      return true;
   }

   registerComponentsRecursively(component, parent = null) {
      // Assign parent if not already set
      if (!component.parentComponent) {
         component.parentComponent = parent;
      }

      // Recursively assign parent to children
      component.querySelectorAll('*').forEach((child) => {
         if (child.tagName.startsWith('SLICE-')) {
            if (!child.parentComponent) {
               child.parentComponent = component;
            }
            this.registerComponentsRecursively(child, component);
         }
      });
   }

   getComponent(sliceId) {
      return this.activeComponents.get(sliceId);
   }

   loadTemplateToComponent(component) {
      const className = component.constructor.name;
      const template = this.templates.get(className);

      if (!template) {
         slice.logger.logError(`Template not found for component: ${className}`);
         return;
      }

      component.innerHTML = template.innerHTML;
      return component;
   }

   getComponentCategory(componentSliceId) {
      return this.componentCategories.get(componentSliceId);
   }

   async fetchText(componentName, resourceType, componentCategory, customPath) {
      try {
         const baseUrl = window.location.origin;
         let path;

         if (!componentCategory) {
            componentCategory = this.componentCategories.get(componentName);
         }

         let isVisual = resourceType === 'html' || resourceType === 'css';

         if (isVisual) {
            if (slice.paths.components[componentCategory]) {
               path = `${baseUrl}${slice.paths.components[componentCategory].path}/${componentName}`;
               resourceType === 'html' ? path += `/${componentName}.html` : path += `/${componentName}.css`;
            } else {
               if (componentCategory === 'Structural') {
                  path = `${baseUrl}/Slice/Components/Structural/${componentName}`;
                  resourceType === 'html' ? path += `/${componentName}.html` : path += `/${componentName}.css`;
               } else {
                  throw new Error(`Component category '${componentCategory}' not found in paths configuration`);
               }
            }
         }

         if (resourceType === 'theme') {
            path = `${baseUrl}${slice.paths.themes}/${componentName}.css`;
         }

         if (resourceType === 'styles') {
            path = `${baseUrl}${slice.paths.styles}/${componentName}.css`;
         }

         if (customPath) {
            path = customPath;
         }

         slice.logger.logInfo('Controller', `Fetching ${resourceType} from: ${path}`);

         const response = await fetch(path);

         if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
         }

         const content = await response.text();
         slice.logger.logInfo('Controller', `Successfully fetched ${resourceType} for ${componentName}`);
         return content;
      } catch (error) {
         slice.logger.logError('Controller', `Error fetching ${resourceType} for component ${componentName}:`, error);
         throw error;
      }
   }

   setComponentProps(component, props) {
      const ComponentClass = component.constructor;
      const componentName = ComponentClass.name;

      // Aplicar defaults si tiene static props
      if (ComponentClass.props) {
         this.applyDefaultProps(component, ComponentClass.props, props);
      }

      // Validar solo en desarrollo
      if (ComponentClass.props && !slice.isProduction()) {
         this.validatePropsInDevelopment(ComponentClass, props, componentName);
      }

      // Aplicar props
      for (const prop in props) {
         component[`_${prop}`] = null;
         component[prop] = props[prop];
      }
   }

   getComponentPropsForDebugger(component) {
      const ComponentClass = component.constructor;
      
      if (ComponentClass.props) {
         return {
            availableProps: Object.keys(ComponentClass.props),
            propsConfig: ComponentClass.props,
            usedProps: this.extractUsedProps(component, ComponentClass.props)
         };
      } else {
         return {
            availableProps: this.extractUsedProps(component),
            propsConfig: null,
            usedProps: this.extractUsedProps(component)
         };
      }
   }

   applyDefaultProps(component, staticProps, providedProps) {
      Object.entries(staticProps).forEach(([prop, config]) => {
         if (config.default !== undefined && !(prop in (providedProps || {}))) {
            component[`_${prop}`] = null;
            component[prop] = config.default;
         }
      });
   }

   validatePropsInDevelopment(ComponentClass, providedProps, componentName) {
      const staticProps = ComponentClass.props;
      const usedProps = Object.keys(providedProps || {});
      
      const availableProps = Object.keys(staticProps);
      const unknownProps = usedProps.filter(prop => !availableProps.includes(prop));
      
      if (unknownProps.length > 0) {
         slice.logger.logWarning(
            'PropsValidator', 
            `${componentName}: Unknown props [${unknownProps.join(', ')}]. Available: [${availableProps.join(', ')}]`
         );
      }

      const requiredProps = Object.entries(staticProps)
         .filter(([_, config]) => config.required)
         .map(([prop, _]) => prop);
      
      const missingRequired = requiredProps.filter(prop => !(prop in (providedProps || {})));
      if (missingRequired.length > 0) {
         slice.logger.logError(
            componentName,
            `Missing required props: [${missingRequired.join(', ')}]`
         );
      }
   }

   extractUsedProps(component, staticProps = null) {
      const usedProps = {};
      
      if (staticProps) {
         Object.keys(staticProps).forEach(prop => {
            if (component[prop] !== undefined) {
               usedProps[prop] = component[prop];
            }
         });
      } else {
         Object.getOwnPropertyNames(component).forEach(key => {
            if (key.startsWith('_') && key !== '_isActive') {
               const propName = key.substring(1);
               usedProps[propName] = component[propName];
            }
         });
      }
      
      return usedProps;
   }

   // ============================================================================
   // 🚀 MÉTODOS DE DESTRUCCIÓN OPTIMIZADOS
   // ============================================================================

   /**
    * Encuentra recursivamente todos los hijos de un componente
    * 🚀 OPTIMIZADO: O(m) en lugar de O(n*d) - usa childrenIndex
    * @param {string} parentSliceId - sliceId del componente padre
    * @param {Set<string>} collected - Set de sliceIds ya recolectados
    * @returns {Set<string>} Set de todos los sliceIds de componentes hijos
    */
   findAllChildComponents(parentSliceId, collected = new Set()) {
      // 🚀 Buscar directamente en el índice: O(1)
      const children = this.childrenIndex.get(parentSliceId);
      
      if (!children) return collected;
      
      // 🚀 Iterar solo los hijos directos: O(k) donde k = número de hijos
      for (const childSliceId of children) {
         collected.add(childSliceId);
         // Recursión solo sobre hijos, no todos los componentes
         this.findAllChildComponents(childSliceId, collected);
      }
      
      return collected;
   }

   /**
    * Encuentra recursivamente todos los componentes dentro de un contenedor DOM
    * Útil para destroyByContainer cuando no tenemos el sliceId del padre
    * @param {HTMLElement} container - Elemento contenedor
    * @param {Set<string>} collected - Set de sliceIds ya recolectados
    * @returns {Set<string>} Set de todos los sliceIds encontrados
    */
   findAllNestedComponentsInContainer(container, collected = new Set()) {
      // Buscar todos los elementos con slice-id en el contenedor
      const sliceComponents = container.querySelectorAll('[slice-id]');
      
      sliceComponents.forEach(element => {
         const sliceId = element.getAttribute('slice-id') || element.sliceId;
         if (sliceId && this.activeComponents.has(sliceId)) {
            collected.add(sliceId);
            // 🚀 Usar índice para buscar hijos recursivamente
            this.findAllChildComponents(sliceId, collected);
         }
      });

      return collected;
   }

   /**
    * Destruye uno o múltiples componentes DE FORMA RECURSIVA
    * 🚀 OPTIMIZADO: O(m log m) en lugar de O(n*d + m log m)
    * @param {HTMLElement|Array<HTMLElement>|string|Array<string>} components 
    * @returns {number} Cantidad de componentes destruidos (incluyendo hijos)
    */
   destroyComponent(components) {
      const toDestroy = Array.isArray(components) ? components : [components];
      const allSliceIdsToDestroy = new Set();

      // PASO 1: Recolectar todos los componentes padres y sus hijos recursivamente
      for (const item of toDestroy) {
         let sliceId = null;

         if (typeof item === 'string') {
            if (!this.activeComponents.has(item)) {
               slice.logger.logWarning('Controller', `Component with sliceId "${item}" not found`);
               continue;
            }
            sliceId = item;
         } else if (item && item.sliceId) {
            sliceId = item.sliceId;
         } else {
            slice.logger.logWarning('Controller', `Invalid component or sliceId provided to destroyComponent`);
            continue;
         }

         allSliceIdsToDestroy.add(sliceId);
         
         // 🚀 OPTIMIZADO: Usa childrenIndex en lugar de recorrer todos los componentes
         this.findAllChildComponents(sliceId, allSliceIdsToDestroy);
      }

      // PASO 2: Ordenar por profundidad (más profundos primero)
      // 🚀 OPTIMIZADO: Usa _depth precalculada en lugar de calcularla cada vez
      const sortedSliceIds = Array.from(allSliceIdsToDestroy).sort((a, b) => {
         const compA = this.activeComponents.get(a);
         const compB = this.activeComponents.get(b);
         
         if (!compA || !compB) return 0;
         
         // 🚀 O(1) en lugar de O(d) - usa profundidad precalculada
         return (compB._depth || 0) - (compA._depth || 0);
      });

      let destroyedCount = 0;

      // PASO 3: Destruir en orden correcto (hijos antes que padres)
      for (const sliceId of sortedSliceIds) {
         const component = this.activeComponents.get(sliceId);
         
         if (!component) continue;

         // Ejecutar hook beforeDestroy si existe
         if (typeof component.beforeDestroy === 'function') {
            try {
               component.beforeDestroy();
            } catch (error) {
               slice.logger.logError('Controller', `Error in beforeDestroy for ${sliceId}`, error);
            }
         }

         // 🚀 Limpiar del índice de hijos
         this.childrenIndex.delete(sliceId);
         
         // Si tiene padre, remover de la lista de hijos del padre
         if (component.parentComponent) {
            const parentChildren = this.childrenIndex.get(component.parentComponent.sliceId);
            if (parentChildren) {
               parentChildren.delete(sliceId);
               // Si el padre no tiene más hijos, eliminar entrada vacía
               if (parentChildren.size === 0) {
                  this.childrenIndex.delete(component.parentComponent.sliceId);
               }
            }
         }

         // Eliminar del mapa de componentes activos
         this.activeComponents.delete(sliceId);

         // Remover del DOM si está conectado
         if (component.isConnected) {
            component.remove();
         }

         destroyedCount++;
      }

      if (destroyedCount > 0) {
         slice.logger.logInfo('Controller', `Destroyed ${destroyedCount} component(s) recursively`);
      }

      return destroyedCount;
   }

   /**
    * Destruye todos los componentes Slice dentro de un contenedor (RECURSIVO)
    * 🚀 OPTIMIZADO: Usa el índice inverso para búsqueda rápida
    * @param {HTMLElement} container - Elemento contenedor
    * @returns {number} Cantidad de componentes destruidos
    */
   destroyByContainer(container) {
      if (!container) {
         slice.logger.logWarning('Controller', 'No container provided to destroyByContainer');
         return 0;
      }

      // 🚀 Recolectar componentes usando índice optimizado
      const allSliceIds = this.findAllNestedComponentsInContainer(container);
      
      if (allSliceIds.size === 0) {
         return 0;
      }

      // Destruir usando el método principal optimizado
      const count = this.destroyComponent(Array.from(allSliceIds));
      
      if (count > 0) {
         slice.logger.logInfo('Controller', `Destroyed ${count} component(s) from container (including nested)`);
      }

      return count;
   }

   /**
    * Destruye componentes cuyos sliceId coincidan con un patrón (RECURSIVO)
    * 🚀 OPTIMIZADO: Usa destrucción optimizada
    * @param {string|RegExp} pattern - Patrón a buscar
    * @returns {number} Cantidad de componentes destruidos
    */
   destroyByPattern(pattern) {
      const componentsToDestroy = [];
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

      for (const [sliceId, component] of this.activeComponents) {
         if (regex.test(sliceId)) {
            componentsToDestroy.push(component);
         }
      }

      if (componentsToDestroy.length === 0) {
         return 0;
      }

      const count = this.destroyComponent(componentsToDestroy);
      
      if (count > 0) {
         slice.logger.logInfo('Controller', `Destroyed ${count} component(s) matching pattern: ${pattern} (including nested)`);
      }

      return count;
   }
}