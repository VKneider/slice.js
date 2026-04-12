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
      this.bundleImportPromises = new Map();
      this.bundleLoadPromises = new Map();

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
            // Critical bundle will be loaded explicitly
          }
          this.criticalBundleLoaded = false;
       } else {
          // No bundles available, will use individual component loading
          this.bundleConfig = null;
          this.criticalBundleLoaded = false;
      }
     }

   /**
    * Import a bundle URL once per page session.
    * Reuses the same Promise for concurrent callers.
    * @param {string} bundlePath
    * @returns {Promise<any>}
    */
   importBundleOnce(bundlePath) {
      if (!bundlePath) {
         return Promise.reject(new Error('Bundle path is required'));
      }

      if (this.bundleImportPromises.has(bundlePath)) {
         return this.bundleImportPromises.get(bundlePath);
      }

      const importPromise = import(bundlePath).catch((error) => {
         this.bundleImportPromises.delete(bundlePath);
         throw error;
      });

      this.bundleImportPromises.set(bundlePath, importPromise);
      return importPromise;
   }

   buildBundleImportPath(bundleInfo) {
      if (!bundleInfo || typeof bundleInfo.file !== 'string' || bundleInfo.file.length === 0) {
         throw new Error('Bundle file is required');
      }

      const basePath = `/bundles/${bundleInfo.file}`;
      const bundleHash = typeof bundleInfo.hash === 'string' ? bundleInfo.hash.trim() : '';
      if (!bundleHash) {
         return basePath;
      }

      return `${basePath}?v=${encodeURIComponent(bundleHash)}`;
   }

   /**
    * Validate Bundling V2 module contract.
    * Requires named exports: SLICE_BUNDLE_META and registerAll.
    * @param {any} bundleModule
    * @param {string} [bundleName]
    * @returns {{metadata: object, registerAll: Function}}
    */
   async validateBundleModule(bundleModule, bundleName = 'unknown') {
      const metadata = bundleModule?.SLICE_BUNDLE_META;
      const registerAll = bundleModule?.registerAll;

      if (!metadata || typeof metadata !== 'object' || typeof registerAll !== 'function') {
         throw new Error(
            `Bundle "${bundleName}" missing Bundling V2 exports contract: requires SLICE_BUNDLE_META and registerAll`
         );
      }

      return { metadata, registerAll };
   }

   /**
    * 📦 Loads a bundle by name or category
    */
   async loadBundle(bundleName) {
      const resolvedBundleName = this.resolveBundleName(bundleName);
      if (this.loadedBundles.has(resolvedBundleName)) {
         return; // Already loaded
       }

       return this.loadBundleWithDependencies(resolvedBundleName, new Set());
      }

   async loadBundleWithDependencies(bundleName, loadingStack = new Set()) {
      const resolvedBundleName = this.resolveBundleName(bundleName);

      if (this.loadedBundles.has(resolvedBundleName)) {
         return;
       }

      if (loadingStack.has(resolvedBundleName)) {
         throw new Error(`Circular bundle dependency detected: ${Array.from(loadingStack).join(' -> ')} -> ${resolvedBundleName}`);
       }

      if (this.bundleLoadPromises.has(resolvedBundleName)) {
         return this.bundleLoadPromises.get(resolvedBundleName);
       }

      const loadPromise = (async () => {
         loadingStack.add(resolvedBundleName);
         try {
            const bundleInfo = this.getBundleInfo(resolvedBundleName);
            if (!bundleInfo) {
               console.warn(`Bundle ${resolvedBundleName} not found in configuration`);
               return;
             }

            const dependencies = this.getBundleDependencies(bundleInfo);
            for (const dependencyName of dependencies) {
               await this.loadBundleWithDependencies(dependencyName, loadingStack);
            }

            const bundlePath = this.buildBundleImportPath(bundleInfo);
            const bundleModule = await this.importBundleOnce(bundlePath);
            const { metadata, registerAll } = await this.validateBundleModule(bundleModule, resolvedBundleName);

            const registerResult = await registerAll(this, slice.stylesManager);
            this.registerVendorSharedDependencies(bundleModule, metadata, resolvedBundleName, registerResult);

            this.loadedBundles.add(resolvedBundleName);
            const loadedBundleKey = metadata.bundleKey;
            if (loadedBundleKey && loadedBundleKey !== resolvedBundleName) {
               this.loadedBundles.add(loadedBundleKey);
             }

            if (metadata.type === 'critical' || resolvedBundleName === 'critical') {
               this.criticalBundleLoaded = true;
             }
         } finally {
            loadingStack.delete(resolvedBundleName);
         }
      })();

      this.bundleLoadPromises.set(resolvedBundleName, loadPromise);
      try {
         return await loadPromise;
      } finally {
         this.bundleLoadPromises.delete(resolvedBundleName);
      }
   }

   resolveBundleName(bundleName) {
      if (typeof bundleName !== 'string' || bundleName.length === 0) {
         return bundleName;
       }

       if (bundleName.toLowerCase() === 'critical') {
          return 'critical';
       }

       if (this.isVendorSharedAlias(bundleName) && this.getVendorSharedBundleInfo()) {
          return 'vendor-shared';
       }

      const routeBundleName = this.findBundleNameByAlias(this.bundleConfig?.bundles?.routes, bundleName);
      if (routeBundleName) {
         return routeBundleName;
      }

      const sharedBundleName = this.findBundleNameByAlias(this.bundleConfig?.bundles?.shared, bundleName);
      if (sharedBundleName) {
         return sharedBundleName;
      }

      return bundleName;
   }

   findBundleNameByAlias(bundleRegistry, bundleName) {
      if (!bundleRegistry || typeof bundleRegistry !== 'object') {
         return null;
      }

      if (bundleRegistry[bundleName]) {
         return bundleName;
      }

      const normalizedName = bundleName?.toLowerCase();
      if (!normalizedName) {
         return null;
      }

      return Object.keys(bundleRegistry).find((key) => key.toLowerCase() === normalizedName) || null;
   }

   getBundleDependencies(bundleInfo) {
      if (!bundleInfo || !Array.isArray(bundleInfo.dependencies)) {
         return [];
      }

      return bundleInfo.dependencies.filter((dependency) => typeof dependency === 'string' && dependency.length > 0);
   }

   findBundleEntryByName(bundleRegistry, bundleName) {
      if (!bundleRegistry || typeof bundleRegistry !== 'object') {
         return null;
      }

      if (bundleRegistry[bundleName]) {
         return bundleRegistry[bundleName];
      }

      const normalizedName = bundleName?.toLowerCase();
      if (!normalizedName) {
         return null;
      }

      const matchedKey = Object.keys(bundleRegistry).find((key) => key.toLowerCase() === normalizedName);
      return matchedKey ? bundleRegistry[matchedKey] : null;
   }

   getBundleInfo(bundleName) {
      if (bundleName === 'critical') {
         return this.bundleConfig?.bundles?.critical || null;
       }

       if (this.isVendorSharedAlias(bundleName)) {
          return this.getVendorSharedBundleInfo();
       }

      return (
         this.findBundleEntryByName(this.bundleConfig?.bundles?.routes, bundleName)
         || this.findBundleEntryByName(this.bundleConfig?.bundles?.shared, bundleName)
      );
   }

   getVendorSharedBundleInfo() {
      if (this.bundleConfig?.bundles?.vendorShared && typeof this.bundleConfig.bundles.vendorShared === 'object') {
         return this.bundleConfig.bundles.vendorShared;
      }

      return this.findBundleEntryByName(this.bundleConfig?.bundles?.shared, 'vendor-shared');
   }

   isVendorSharedAlias(bundleName) {
      if (typeof bundleName !== 'string') {
         return false;
      }

      const normalized = bundleName.toLowerCase();
      return normalized === 'vendor-shared' || normalized === 'vendorshared';
   }

   registerVendorSharedDependencies(bundleModule, metadata, bundleName, registerResult) {
      const isVendorShared = this.isVendorSharedBundleName(metadata?.bundleKey)
         || this.isVendorSharedBundleName(bundleName)
         || metadata?.registerVendorSharedDependencies === true;

      if (!isVendorShared) {
         return;
       }

       let sharedDeps = bundleModule?.SLICE_SHARED_DEPS;
       if (!sharedDeps && registerResult && typeof registerResult === 'object') {
          sharedDeps = registerResult.SLICE_SHARED_DEPS
             || registerResult.SLICE_BUNDLE_DEPENDENCIES
             || registerResult;
       }

       if (!sharedDeps || typeof sharedDeps !== 'object') {
          return;
       }

      if (!window.__SLICE_SHARED_DEPS__ || typeof window.__SLICE_SHARED_DEPS__ !== 'object') {
         window.__SLICE_SHARED_DEPS__ = {};
      }

      Object.assign(window.__SLICE_SHARED_DEPS__, sharedDeps);
   }

   isVendorSharedBundleName(bundleName) {
      return typeof bundleName === 'string' && bundleName.toLowerCase() === 'vendor-shared';
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
                           return exports
                              .split(',')
                              .map((exp) => {
                                 const cleanExp = exp.trim();
                                 const varName = cleanExp.split(' as ')[0].trim();
                                 return `window.${varName} = ${varName};`;
                              })
                              .join('\n');
                        })
                        // Remove any remaining export keywords
                        .replace(/^\s*export\s+/gm, '');

                     // Evaluate the dependency
                     try {
                        new Function('slice', 'customElements', 'window', 'document', processedContent)(
                           window.slice,
                           window.customElements,
                           window,
                           window.document
                        );
                     } catch (evalError) {
                        console.warn(`❌ Failed to evaluate processed dependency ${depName}:`, evalError);
                        console.warn('Processed content preview:', processedContent.substring(0, 200));
                        // Try evaluating the original content as fallback
                        try {
                           new Function('slice', 'customElements', 'window', 'document', depContent)(
                              window.slice,
                              window.customElements,
                              window,
                              window.document
                           );
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
                              return exports
                                 .split(',')
                                 .map((exp) => {
                                    const cleanExp = exp.trim();
                                    return `window.${cleanExp} = ${cleanExp};`;
                                 })
                                 .join('\n');
                           });
                     })
                     .join('\n\n');

                  evalCode = depCode + '\n\n' + evalCode;
               }

               // Evaluate the complete code
               const componentClass = new Function(
                  'slice',
                  'customElements',
                  'window',
                  'document',
                  `
                     "use strict";
                     ${evalCode}
                     return ${componentName};
                  `
               )(window.slice, window.customElements, window, window.document);

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
       const validation = this.validateBundle(bundle);
       if (!validation.isValid) {
          console.warn(`❌ Bundle validation failed: ${validation.error}`);
          return Promise.resolve(false);
       }

     // Set tracking flags synchronously before any async work, so callers that
     // await import() see the flags set immediately when the Promise resolves.
     const { components, metadata } = bundle;
     const bundleKey = metadata?.bundleKey;
     if (bundleKey) {
        this.loadedBundles.add(bundleKey);
        if (metadata?.type === 'critical') {
           this.criticalBundleLoaded = true;
        }
     }

    console.log(`📦 Registering bundle: ${metadata.type} (${metadata.componentCount} components)`);

      const entries = Object.entries(components);
      const chunkSize = 50;
      let index = 0;

       return new Promise((resolve) => {
         const processChunk = () => {
          const sliceEntries = entries.slice(index, index + chunkSize);

         for (const [componentName, componentData] of sliceEntries) {
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
                  }
               }

                if (componentData.class && !this.classes.has(componentName)) {
                   const registeredName = componentData.isFramework
                      ? `Framework/Structural/${componentName}`
                      : componentName;
                   this.classes.set(registeredName, componentData.class);
                   if (componentName === 'Loading') {
                      console.log('🔎 Bundle class registered: Loading', {
                         registeredName,
                         type: typeof componentData.class,
                         isFunction: typeof componentData.class === 'function'
                      });
                   }
                   if (componentName === 'InputSearchDocs' || componentName === 'MainMenu') {
                      console.log(`🔎 Bundle class registered: ${componentName}`, {
                         registeredName,
                         type: typeof componentData.class,
                         isFunction: typeof componentData.class === 'function'
                      });
                   }
                }
            } catch (error) {
               console.warn(`❌ Failed to register component ${componentName}:`, error);
            }
         }

         index += chunkSize;
          if (index < entries.length) {
             if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(processChunk);
             } else {
                setTimeout(processChunk, 0);
             }
             return;
          }

          console.log(`✅ Bundle registration completed: ${metadata.componentCount} components processed`);
          resolve(true);
        };

        processChunk();
       });
     }

    /**
     * Validates bundle structure before registering.
     * @param {object} bundle
     * @returns {{isValid: boolean, error?: string}}
     */
    validateBundle(bundle) {
       if (!bundle || typeof bundle !== 'object') {
          return { isValid: false, error: 'Bundle payload is invalid' };
       }

       if (!bundle.metadata || typeof bundle.metadata !== 'object') {
          return { isValid: false, error: 'Bundle metadata missing' };
       }

       if (!bundle.components || typeof bundle.components !== 'object') {
          return { isValid: false, error: 'Bundle components missing' };
       }

       if (typeof bundle.metadata.componentCount !== 'number') {
          return { isValid: false, error: 'Bundle metadata missing componentCount' };
       }

       if (bundle.metadata.componentCount !== Object.keys(bundle.components).length) {
          return { isValid: false, error: 'Bundle component count mismatch' };
       }

       const maxComponents = 5000;
       if (bundle.metadata.componentCount > maxComponents) {
          return { isValid: false, error: 'Bundle component count exceeds limit' };
       }

       return { isValid: true };
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
         ...Object.entries(this.bundleConfig.bundles.routes || {}).map(([name, data]) => ({ name, data })),
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

   /**
    * Get a registered component by sliceId.
    * @param {string} sliceId
    * @returns {HTMLElement|undefined}
    */
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

   /**
    * Fetch component resources (html, css, styles, theme).
    * @param {string} componentName
    * @param {'html'|'css'|'theme'|'styles'} resourceType
    * @param {string} [componentCategory]
    * @param {string} [customPath]
    * @returns {Promise<string>}
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
            if (slice.paths.components[componentCategory]) {
               path = `${baseUrl}${slice.paths.components[componentCategory].path}/${componentName}`;
               resourceType === 'html' ? (path += `/${componentName}.html`) : (path += `/${componentName}.css`);
            } else {
               if (componentCategory === 'Structural') {
                  path = `${baseUrl}/Slice/Components/Structural/${componentName}`;
                  resourceType === 'html' ? (path += `/${componentName}.html`) : (path += `/${componentName}.css`);
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

   /**
    * Apply props to a component using static defaults and setters.
    * @param {HTMLElement} component
    * @param {Object} props
    * @returns {void}
    */
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
            usedProps: this.extractUsedProps(component, ComponentClass.props),
         };
      } else {
         return {
            availableProps: this.extractUsedProps(component),
            propsConfig: null,
            usedProps: this.extractUsedProps(component),
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
      const unknownProps = usedProps.filter((prop) => !availableProps.includes(prop));

      if (unknownProps.length > 0) {
         slice.logger.logWarning(
            'PropsValidator',
            `${componentName}: Unknown props [${unknownProps.join(', ')}]. Available: [${availableProps.join(', ')}]`
         );
      }

      const requiredProps = Object.entries(staticProps)
         .filter(([_, config]) => config.required)
         .map(([prop, _]) => prop);

      const missingRequired = requiredProps.filter((prop) => !(prop in (providedProps || {})));
      if (missingRequired.length > 0) {
         slice.logger.logError(componentName, `Missing required props: [${missingRequired.join(', ')}]`);
      }
   }

   extractUsedProps(component, staticProps = null) {
      const usedProps = {};

      if (staticProps) {
         Object.keys(staticProps).forEach((prop) => {
            if (component[prop] !== undefined) {
               usedProps[prop] = component[prop];
            }
         });
      } else {
         Object.getOwnPropertyNames(component).forEach((key) => {
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

      sliceComponents.forEach((element) => {
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

         // Limpiar suscripciones de eventos del componente
         if (slice.events) {
            slice.events.cleanupComponent(sliceId);
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
         slice.logger.logInfo(
            'Controller',
            `Destroyed ${count} component(s) matching pattern: ${pattern} (including nested)`
         );
      }

      return count;
   }
}
