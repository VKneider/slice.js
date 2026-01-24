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

      // 📦 Bundle system
      this.loadedBundles = new Set();
      this.bundleConfig = null;
      this.criticalBundleLoaded = false;

      this.idCounter = 0;
   }

   /**
    * 📦 Initializes bundle system (called automatically when config is loaded)
    */
   initializeBundles(config = null) {
      if (config) {
         this.bundleConfig = config;

         // Register critical bundle components if available
         if (config.bundles?.critical) {
            // The critical bundle should already be loaded, register its components
            this.loadedBundles.add('critical');
            // Note: Critical bundle registration is handled by the auto-import
         }
         this.criticalBundleLoaded = true;
      } else {
         // No bundles available, will use individual component loading
         this.bundleConfig = null;
         this.criticalBundleLoaded = false;
      }
   }

   /**
    * 📦 Loads a bundle by name or category
    */
   async loadBundle(bundleName) {
      if (this.loadedBundles.has(bundleName)) {
         return; // Already loaded
      }

      try {
         let bundleInfo = this.bundleConfig?.bundles?.routes?.[bundleName];

         if (!bundleInfo && this.bundleConfig?.bundles?.routes) {
            const normalizedName = bundleName?.toLowerCase();
            const matchedKey = Object.keys(this.bundleConfig.bundles.routes)
               .find(key => key.toLowerCase() === normalizedName);
            if (matchedKey) {
               bundleInfo = this.bundleConfig.bundles.routes[matchedKey];
            }
         }

         if (!bundleInfo) {
            console.warn(`Bundle ${bundleName} not found in configuration`);
            return;
         }

         const bundlePath = `/bundles/${bundleInfo.file}`;

         // Dynamic import of the bundle
         const bundleModule = await import(bundlePath);

         // Manually register components from the imported bundle
         if (bundleModule.SLICE_BUNDLE) {
            this.registerBundle(bundleModule.SLICE_BUNDLE);
         }

         this.loadedBundles.add(bundleName);

      } catch (error) {
         console.warn(`Failed to load bundle ${bundleName}:`, error);
      }
   }

   /**
    * 📦 Registers a bundle's components (called automatically by bundle files)
    */
   registerBundleLegacy(bundle) {
      const { components, metadata } = bundle;

      console.log(`📦 Registering bundle: ${metadata.type} (${metadata.componentCount} components)`);

      // Phase 1: Register templates and CSS for all components first
      for (const [componentName, componentData] of Object.entries(components)) {
         try {
            // Register HTML template
            if (componentData.html !== undefined && !this.templates.has(componentName)) {
               const template = document.createElement('template');
               template.innerHTML = componentData.html || '';
               this.templates.set(componentName, template);
            }

            // Register CSS styles
            if (componentData.css !== undefined && !this.requestedStyles.has(componentName)) {
               // Use the existing stylesManager to register component styles
               if (window.slice && window.slice.stylesManager) {
                  window.slice.stylesManager.registerComponentStyles(componentName, componentData.css || '');
                  this.requestedStyles.add(componentName);
               }
            }
         } catch (error) {
            console.warn(`❌ Failed to register assets for ${componentName}:`, error);
         }
      }

      // Phase 2: Evaluate all external file dependencies
      const processedDeps = new Set();
      for (const [componentName, componentData] of Object.entries(components)) {
         if (componentData.dependencies) {
            for (const [depName, depContent] of Object.entries(componentData.dependencies)) {
               if (!processedDeps.has(depName)) {
                  try {
                     // Convert ES6 exports to global assignments
                     let processedContent = depContent
                        .replace(/export\s+const\s+(\w+)\s*=/g, 'window.$1 =')
                        .replace(/export\s+let\s+(\w+)\s*=/g, 'window.$1 =')
                        .replace(/export\s+var\s+(\w+)\s*=/g, 'window.$1 =')
                        .replace(/export\s+function\s+(\w+)/g, 'window.$1 = function')
                        .replace(/export\s+default\s+/g, 'window.defaultExport =')
                        .replace(/export\s*{\s*([^}]+)\s*}/g, (match, exports) => {
                           return exports.split(',').map(exp => {
                              const cleanExp = exp.trim();
                              const varName = cleanExp.split(' as ')[0].trim();
                              return `window.${varName} = ${varName};`;
                           }).join('\n');
                        })
                        // Remove any remaining export keywords
                        .replace(/^\s*export\s+/gm, '');

                     // Evaluate the dependency
                     try {
                        new Function('slice', 'customElements', 'window', 'document', processedContent)
                           (window.slice, window.customElements, window, window.document);
                     } catch (evalError) {
                        console.warn(`❌ Failed to evaluate processed dependency ${depName}:`, evalError);
                        console.warn('Processed content preview:', processedContent.substring(0, 200));
                        // Try evaluating the original content as fallback
                        try {
                           new Function('slice', 'customElements', 'window', 'document', depContent)
                              (window.slice, window.customElements, window, window.document);
                           console.log(`✅ Fallback evaluation succeeded for ${depName}`);
                        } catch (fallbackError) {
                           console.warn(`❌ Fallback evaluation also failed for ${depName}:`, fallbackError);
                        }
                     }

                     processedDeps.add(depName);
                     console.log(`📄 Dependency loaded: ${depName}`);
                  } catch (depError) {
                     console.warn(`⚠️ Failed to load dependency ${depName} for ${componentName}:`, depError);
                  }
               }
            }
         }
      }

      // Phase 3: Evaluate all component classes (now that dependencies are available)
      for (const [componentName, componentData] of Object.entries(components)) {
         // For JavaScript classes, we need to evaluate the code
         if (componentData.js && !this.classes.has(componentName)) {
               try {
                  // Create evaluation context with dependencies
                  let evalCode = componentData.js;

                  // Prepend dependencies to make them available
                  if (componentData.dependencies) {
                     const depCode = Object.entries(componentData.dependencies)
                        .map(([depName, depContent]) => {
                           // Convert ES6 exports to global assignments
                           return depContent
                              .replace(/export\s+const\s+(\w+)\s*=/g, 'window.$1 =')
                              .replace(/export\s+let\s+(\w+)\s*=/g, 'window.$1 =')
                              .replace(/export\s+function\s+(\w+)/g, 'window.$1 = function')
                              .replace(/export\s+default\s+/g, 'window.defaultExport =')
                              .replace(/export\s*{\s*([^}]+)\s*}/g, (match, exports) => {
                                 return exports.split(',').map(exp => {
                                    const cleanExp = exp.trim();
                                    return `window.${cleanExp} = ${cleanExp};`;
                                 }).join('\n');
                              });
                        })
                        .join('\n\n');

                     evalCode = depCode + '\n\n' + evalCode;
                  }

                  // Evaluate the complete code
                  const componentClass = new Function('slice', 'customElements', 'window', 'document', `
                     "use strict";
                     ${evalCode}
                     return ${componentName};
                  `)(window.slice, window.customElements, window, window.document);

                  if (componentClass) {
                     this.classes.set(componentName, componentClass);
                     console.log(`📝 Class registered for: ${componentName}`);
                  }
               } catch (error) {
                  console.warn(`❌ Failed to evaluate class for ${componentName}:`, error);
                  console.warn('Code that failed:', componentData.js.substring(0, 200) + '...');
               }
            }
         }
      }



   /**
    * 📦 New bundle registration method (simplified and robust)
    */
   registerBundle(bundle) {
      const { components, metadata } = bundle;

      console.log(`📦 Registering bundle: ${metadata.type} (${metadata.componentCount} components)`);

      // Phase 1: Register all templates and CSS first
      for (const [componentName, componentData] of Object.entries(components)) {
         try {
            if (componentData.html !== undefined && !this.templates.has(componentName)) {
               const template = document.createElement('template');
               template.innerHTML = componentData.html || '';
               this.templates.set(componentName, template);
            }

            if (componentData.css !== undefined && !this.requestedStyles.has(componentName)) {
               if (window.slice && window.slice.stylesManager) {
                  window.slice.stylesManager.registerComponentStyles(componentName, componentData.css || '');
                  this.requestedStyles.add(componentName);
                  console.log(`🎨 CSS registered for: ${componentName}`);
               }
            }
         } catch (error) {
            console.warn(`❌ Failed to register assets for ${componentName}:`, error);
         }
      }

      // Phase 2: Evaluate all external file dependencies first
      const processedDeps = new Set();
      for (const [componentName, componentData] of Object.entries(components)) {
         if (componentData.externalDependencies) {
            for (const [depName, depEntry] of Object.entries(componentData.externalDependencies)) {
               const depKey = depName || '';
               if (!processedDeps.has(depKey)) {
                  try {
                     const depContent = typeof depEntry === 'string' ? depEntry : depEntry.content;
                     const bindings = typeof depEntry === 'string' ? [] : (depEntry.bindings || []);

                     const fileBaseName = depKey
                        ? depKey.split('/').pop().replace(/\.[^.]+$/, '')
                        : '';
                     const dataName = fileBaseName ? `${fileBaseName}Data` : '';
                     const exportPrefix = dataName ? `window.${dataName} = ` : '';

                     // Process ES6 exports to make the code evaluable
                     let processedContent = depContent
                        // Convert named exports: export const varName = ... → window.varName = ...
                        .replace(/export\s+const\s+(\w+)\s*=\s*/g, 'window.$1 = ')
                        .replace(/export\s+let\s+(\w+)\s*=\s*/g, 'window.$1 = ')
                        .replace(/export\s+function\s+(\w+)/g, 'window.$1 = function')
                        .replace(/export\s+default\s+/g, 'window.defaultExport = ')
                        // Promote default export to <file>Data for data modules
                        .replace(/window\.defaultExport\s*=\s*/g, exportPrefix || 'window.defaultExport = ')
                        // Handle export { var1, var2 } statements
                        .replace(/export\s*{\s*([^}]+)\s*}/g, (match, exportsStr) => {
                           const exports = exportsStr.split(',').map(exp => exp.trim().split(' as ')[0].trim());
                           return exports.map(varName => `window.${varName} = ${varName};`).join('\n');
                        })
                        // Remove any remaining export keywords
                        .replace(/^\s*export\s+/gm, '');

                     // Evaluate the processed content
                     new Function('slice', 'customElements', 'window', 'document', processedContent)
                        (window.slice, window.customElements, window, window.document);

                     // Apply import bindings to map local identifiers to globals
                     for (const binding of bindings) {
                        if (!binding?.localName) continue;

                        if (binding.type === 'default') {
                           if (!window[binding.localName]) {
                              const fallbackValue = dataName && window[dataName] !== undefined
                                 ? window[dataName]
                                 : window.defaultExport;
                              if (fallbackValue !== undefined) {
                                 window[binding.localName] = fallbackValue;
                              }
                           }
                        }

                        if (binding.type === 'named') {
                           if (!window[binding.localName] && window[binding.importedName] !== undefined) {
                              window[binding.localName] = window[binding.importedName];
                           }
                        }

                        if (binding.type === 'namespace' && !window[binding.localName]) {
                           const namespace = {};
                           Object.keys(window).forEach((key) => {
                              namespace[key] = window[key];
                           });
                           window[binding.localName] = namespace;
                        }
                     }

                     processedDeps.add(depKey);
                     console.log(`📄 External dependency loaded: ${depName}`);
                  } catch (depError) {
                     console.warn(`⚠️ Failed to load external dependency ${depName}:`, depError);
                     const preview = typeof depEntry === 'string' ? depEntry : depEntry.content;
                     console.warn('Original content preview:', preview.substring(0, 200));
                  }
               }
            }
         }
      }

      // Phase 3: Evaluate all component classes (external dependencies are now available)
      for (const [componentName, componentData] of Object.entries(components)) {
         if (componentData.js && !this.classes.has(componentName)) {
            try {
               // Simple evaluation
               const componentClass = new Function('slice', 'customElements', 'window', 'document', `
                  ${componentData.js}
                  return ${componentName};
               `)(window.slice, window.customElements, window, window.document);

               if (componentClass) {
                  this.classes.set(componentName, componentClass);
                  console.log(`📝 Class registered for: ${componentName}`);
               }
            } catch (error) {
               console.warn(`❌ Failed to evaluate class for ${componentName}:`, error);
               // Continue with other components instead of failing completely
            }
         }
      }

      console.log(`✅ Bundle registration completed: ${metadata.componentCount} components processed`);
   }

   /**
    * 📦 Determines which bundle to load for a component
    */
   getBundleForComponent(componentName) {
      if (!this.bundleConfig?.bundles) return null;

      // Check if component is in critical bundle
      if (this.bundleConfig.bundles.critical?.components?.includes(componentName)) {
         return 'critical';
      }

      // Find component in route bundles
      if (this.bundleConfig.bundles.routes) {
         for (const [bundleName, bundleInfo] of Object.entries(this.bundleConfig.bundles.routes)) {
            if (bundleInfo.components?.includes(componentName)) {
               return bundleName;
            }
         }
      }

      return null;
   }

   /**
    * 📦 Checks if a component is available from loaded bundles
    */
   isComponentFromBundle(componentName) {
      if (!this.bundleConfig?.bundles) return false;

      // Check critical bundle
      if (this.bundleConfig.bundles.critical?.components?.includes(componentName)) {
         return this.criticalBundleLoaded;
      }

      // Check route bundles
      if (this.bundleConfig.bundles.routes) {
         for (const [bundleName, bundleInfo] of Object.entries(this.bundleConfig.bundles.routes)) {
            if (bundleInfo.components?.includes(componentName)) {
               return this.loadedBundles.has(bundleName);
            }
         }
      }

      return false;
   }

   /**
    * 📦 Gets component data from loaded bundles
    */
   getComponentFromBundle(componentName) {
      if (!this.bundleConfig?.bundles) return null;

      // Find component in any loaded bundle
      const allBundles = [
         { name: 'critical', data: this.bundleConfig.bundles.critical },
         ...Object.entries(this.bundleConfig.bundles.routes || {}).map(([name, data]) => ({ name, data }))
      ];

      for (const { name: bundleName, data: bundleData } of allBundles) {
         if (bundleData?.components?.includes(componentName) && this.loadedBundles.has(bundleName)) {
            // Find the bundle file and extract component data
            // This is a simplified version - in practice you'd need to access the loaded bundle data
            return { bundleName, componentName };
         }
      }

      return null;
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
