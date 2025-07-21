import components from '/Components/components.js';

export default class Controller {
   constructor() {
      this.componentCategories = new Map(Object.entries(components));
      this.templates = new Map();
      this.classes = new Map();
      this.requestedStyles = new Set();
      this.activeComponents = new Map();
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

   registerComponent(component, parent = null) {
      component.parentComponent = parent;
      this.activeComponents.set(component.sliceId, component);
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

   //Attach template to component
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

   /*
      Fetches a text resource (HTML, CSS, theme, or styles) for a component.
      @param {string} componentName - The name of the component.
      @param {string} resourceType - The type of resource to fetch ('html', 'css', 'theme', or 'styles').
      @param {string} [componentCategory] - Optional category of the component.
      @param {string} [customPath] - Optional custom path to fetch the resource from.
      @returns {Promise<string>} - A promise that resolves to the fetched text.
   */
   async fetchText(componentName, resourceType, componentCategory, customPath) {
      try {
         const baseUrl = window.location.origin;
         let path;

         if (!componentCategory) {
            componentCategory = this.componentCategories.get(componentName);
         }

         let isVisual = resourceType === 'html' || resourceType === 'css';

         if (isVisual) {
            // ✅ CORREGIDO: Verificar que la categoría existe y agregar baseUrl
            if (slice.paths.components[componentCategory]) {
               path = `${baseUrl}${slice.paths.components[componentCategory].path}/${componentName}`;
               resourceType === 'html' ? path += `/${componentName}.html` : path += `/${componentName}.css`;
            } else {
               // ✅ FALLBACK: Para componentes Structural o categorías no configuradas
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

         // ✅ MEJORADO: Logging para debugging
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
         // ✅ CORREGIDO: Re-lanzar el error para que el debugger pueda manejarlo
         throw error;
      }
   }

   setComponentProps(component, props) {
      const ComponentClass = component.constructor;
      const componentName = ComponentClass.name;

      // ✅ Aplicar defaults si tiene static props
      if (ComponentClass.props) {
         this.applyDefaultProps(component, ComponentClass.props, props);
      }

      // ✅ Validar solo en desarrollo
      if (ComponentClass.props && !slice.isProduction()) {
         this.validatePropsInDevelopment(ComponentClass, props, componentName);
      }

      // ✅ CÓDIGO EXISTENTE: Aplicar props
      for (const prop in props) {
         component[`_${prop}`] = null;
         component[prop] = props[prop];
      }
   }

   getComponentPropsForDebugger(component) {
      const ComponentClass = component.constructor;
      
      if (ComponentClass.props) {
         // Si tiene props estáticos, usar esos como referencia
         return {
            availableProps: Object.keys(ComponentClass.props),
            propsConfig: ComponentClass.props,
            usedProps: this.extractUsedProps(component, ComponentClass.props)
         };
      } else {
         // Si no tiene props estáticos, usar modo legacy
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
         // Si tiene props estáticos, buscar solo esos
         Object.keys(staticProps).forEach(prop => {
            if (component[prop] !== undefined) {
               usedProps[prop] = component[prop];
            }
         });
      } else {
         // Modo legacy: buscar cualquier prop que empiece con _
         Object.getOwnPropertyNames(component).forEach(key => {
            if (key.startsWith('_') && key !== '_isActive') {
               const propName = key.substring(1);
               usedProps[propName] = component[propName];
            }
         });
      }
      
      return usedProps;
   }

   destroyComponent(component) {
      const sliceId = component.sliceId;
      this.activeComponents.delete(sliceId);
      component.remove();
   }
}

function getRelativePath(levels) {
   return '../'.repeat(levels);
}