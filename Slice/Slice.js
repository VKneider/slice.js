
/**
 * Main Slice.js runtime.
 */
export default class Slice {
   /**
    * @param {Object} sliceConfig
    */
    constructor(sliceConfig, frameworkClasses = null) {
      this.frameworkClasses = frameworkClasses;
      const ControllerClass = frameworkClasses?.Controller;
      const StylesManagerClass = frameworkClasses?.StylesManager;

      this.controller = ControllerClass ? new ControllerClass() : null;
      this.stylesManager = StylesManagerClass ? new StylesManagerClass() : null;
      this.paths = sliceConfig.paths;
      this.themeConfig = sliceConfig.themeManager;
      this.stylesConfig = sliceConfig.stylesManager;
      this.loggerConfig = sliceConfig.logger;
      this.debuggerConfig = sliceConfig.debugger;
      this.loadingConfig = sliceConfig.loading;
      this.eventsConfig = sliceConfig.events;

      // Default to production until init() resolves the actual mode.
      // Safe to call isProduction() before init() completes.
      this._mode = 'production';

      // 📦 Bundle system is initialized automatically via import in index.js
   }

   /**
    * Dynamically import a module and return its default export.
    * @param {string} module
    * @returns {Promise<any>}
    */
   async getClass(module) {
      try {
         const { default: myClass } = await import(module);
         return await myClass;
      } catch (error) {
         this.logger.logError('Slice', `Error loading class ${module}`, error);
      }
   }

   /**
    * Returns true when running in production mode.
    * Reliable after init() has completed.
    * @returns {boolean}
    */
   isProduction() {
      return this._mode === 'production';
   }

   /**
    * Get a component instance by sliceId.
    * @param {string} componentSliceId
    * @returns {HTMLElement|undefined}
    */
   getComponent(componentSliceId) {
      return this.controller.activeComponents.get(componentSliceId);
   }

   /**
    * Build a component instance and run init.
    * @param {string} componentName
    * @param {Object} [props]
    * @returns {Promise<HTMLElement|Object|null>}
    */
   async build(componentName, props = {}) {
      if (!componentName) {
         this.logger.logError('Slice', null, `Component name is required to build a component`);
         return null;
      }

      if (typeof componentName !== 'string') {
         this.logger.logError('Slice', null, `Component name must be a string`);
         return null;
      }

      if (!this.controller.componentCategories.has(componentName)) {
         this.logger.logError('Slice', null, `Component ${componentName} not found in components.js file`);
         return null;
      }

      // 📦 Try to load from bundles first
      const bundleName = this.controller.getBundleForComponent(componentName);
      if (bundleName && !this.controller.loadedBundles.has(bundleName)) {
         await this.controller.loadBundle(bundleName);
      }

      let componentCategory = this.controller.componentCategories.get(componentName);

      // 📦 Check if component is already available from loaded bundles
      const isFromBundle = this.controller.isComponentFromBundle(componentName);

      if (componentCategory === 'Structural') {
         this.logger.logError(
            'Slice',
            null,
            `Component ${componentName} is a Structural component and cannot be built`
         );
         return null;
      }

      let isVisual = slice.paths.components[componentCategory].type === 'Visual';
      let modulePath = `${slice.paths.components[componentCategory].path}/${componentName}/${componentName}.js`;

      // Load template, class, and CSS concurrently if needed
      try {
         // 📦 Skip individual loading if component is available from bundles
         const loadTemplate =
            isFromBundle || !isVisual || this.controller.templates.has(componentName)
               ? Promise.resolve(null)
               : this.controller.fetchText(componentName, 'html', componentCategory);

         const loadClass =
            isFromBundle || this.controller.classes.has(componentName)
               ? Promise.resolve(null)
               : this.getClass(modulePath);

         const loadCSS =
            isFromBundle || !isVisual || this.controller.requestedStyles.has(componentName)
               ? Promise.resolve(null)
               : this.controller.fetchText(componentName, 'css', componentCategory);

         const [html, ComponentClass, css] = await Promise.all([loadTemplate, loadClass, loadCSS]);

         // 📦 If component is from bundle but not in cache, it should have been registered by registerBundle
         if (isFromBundle) {
            console.log(`📦 Using bundled component: ${componentName}`);
         }

         if (html || html === '') {
            const template = document.createElement('template');
            template.innerHTML = html;
            this.controller.templates.set(componentName, template);
            this.logger.logInfo('Slice', `Template ${componentName} loaded`);
         }

         if (ComponentClass) {
            this.controller.classes.set(componentName, ComponentClass);
            this.logger.logInfo('Slice', `Class ${componentName} loaded`);
         }

         if (css) {
            this.stylesManager.registerComponentStyles(componentName, css);
            this.logger.logInfo('Slice', `CSS ${componentName} loaded`);
         }
      } catch (error) {
         console.log(error);
         this.logger.logError('Slice', `Error loading resources for ${componentName}`, error);
         return null;
      }

      // Create instance
      try {
         let componentIds = {};
         if (props.id) componentIds.id = props.id;
         if (props.sliceId) componentIds.sliceId = props.sliceId;

         delete props.id;
         delete props.sliceId;

       const ComponentClass = this.controller.classes.get(componentName);
       if (componentName === 'Loading') {
          console.log('🔎 Build component: Loading', {
             classType: typeof ComponentClass,
             isFunction: typeof ComponentClass === 'function',
             classValue: ComponentClass
          });
       }
       if (componentName === 'InputSearchDocs' || componentName === 'MainMenu') {
          console.log(`🔎 Build component: ${componentName}`, {
             classType: typeof ComponentClass,
             isFunction: typeof ComponentClass === 'function',
             classValue: ComponentClass
          });
       }
       const componentInstance = new ComponentClass(props);

         if (componentIds.id && isVisual) componentInstance.id = componentIds.id;
         if (componentIds.sliceId) componentInstance.sliceId = componentIds.sliceId;

         if (!this.controller.verifyComponentIds(componentInstance)) {
            this.logger.logError('Slice', `Error registering instance ${componentName} ${componentInstance.sliceId}`);
            return null;
         }

         if (componentInstance.init) await componentInstance.init();

         if (slice.debuggerConfig.enabled && isVisual) {
            this.debugger.attachDebugMode(componentInstance);
         }

         this.controller.registerComponent(componentInstance);
         if (isVisual) {
            this.controller.registerComponentsRecursively(componentInstance);
         }

         this.logger.logInfo('Slice', `Instance ${componentInstance.sliceId} created`);
         return componentInstance;
      } catch (error) {
         console.log(error);
         this.logger.logError('Slice', `Error creating instance ${componentName}`, error);
         return null;
      }
   }

   /**
    * Apply a theme by name.
    * @param {string} themeName
    * @returns {Promise<void>}
    */
   async setTheme(themeName) {
      await this.stylesManager.themeManager.applyTheme(themeName);
   }

   /**
    * Current theme name.
    * @returns {string|null}
    */
   get theme() {
      return this.stylesManager.themeManager.currentTheme;
   }

   /**
    * Attach HTML template to a component instance.
    * @param {HTMLElement} componentInstance
    * @returns {void}
    */
   attachTemplate(componentInstance) {
      this.controller.loadTemplateToComponent(componentInstance);
   }
}

async function loadConfig() {
   try {
      const response = await fetch('/sliceConfig.json'); // 🔹 Express lo sirve desde `src/`
      if (!response.ok) throw new Error('Error loading sliceConfig.json');
      const json = await response.json();
      return json;
   } catch (error) {
      console.error(`Error loading config file: ${error.message}`);
      return null;
   }
}

async function init() {
   const sliceConfig = await loadConfig();
   if (!sliceConfig) {
      //Display error message in console with colors and alert in english
      console.error('%c⛔️ Error loading Slice configuration ⛔️', 'color: red; font-size: 20px;');
      alert('Error loading Slice configuration');
      return;
   }

    // 1+2. Fetch mode endpoint and bundle config in parallel — both are independent.
    // In production, /slice-env.json returns 404 (catch is expected and normal).
    // bundleConfigJson.production serves as a mode fallback when env endpoint is absent.
    let frameworkClasses = null;
    const [envResult, configResult] = await Promise.all([
      fetch('/slice-env.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      fetch('/bundles/bundle.config.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    ]);
    const envMode = envResult?.mode ?? null;
    const bundleConfigJson = configResult;

    // 3. Determine canonical mode: env endpoint takes precedence, then bundle config
    let resolvedMode;
    if (envMode) {
      resolvedMode = envMode;
    } else if (bundleConfigJson?.production) {
      resolvedMode = 'production';
    } else {
      resolvedMode = 'development';
    }

     // Pre-fetch critical bundle to warm the browser HTTP cache while the framework
     // bundle is downloading and executing. fetch() downloads bytes without evaluating
     // the module, so the auto-registration block runs safely later when window.slice
     // already exists. Errors are silently ignored — import() will retry if needed.
     if (resolvedMode === 'production' && bundleConfigJson?.bundles?.critical?.file) {
       fetch(`/bundles/${bundleConfigJson.bundles.critical.file}`).catch(() => {});
     }

     // 4. Load framework classes.
     // In production the bundler generates slice-bundle.framework.js which
     // sets window.SLICE_FRAMEWORK_CLASSES. In dev mode always use individual
     // imports so the live /Slice/ source is served directly without bundles.
     if (resolvedMode === 'production' && bundleConfigJson?.bundles?.framework?.file) {
       try {
         await import(`/bundles/${bundleConfigJson.bundles.framework.file}`);
         if (window.SLICE_FRAMEWORK_CLASSES) {
           frameworkClasses = window.SLICE_FRAMEWORK_CLASSES;
         }
        } catch (e) {
          // framework bundle failed — fall through to individual imports
          console.error('[Slice.js] framework bundle import failed:', e?.message || e);
        }
     }

     if (!frameworkClasses) {
       try {
         const imports = await Promise.all([
           import('./Components/Structural/Controller/Controller.js'),
           import('./Components/Structural/StylesManager/StylesManager.js')
         ]);
         frameworkClasses = {
           Controller: imports[0].default,
           StylesManager: imports[1].default
         };
       } catch (e) {
         console.error('[Slice.js] individual imports fallback failed:', e?.message || e);
         throw e;
       }
     }

    // 5. Create Slice instance and set resolved mode
    window.slice = new Slice(sliceConfig, frameworkClasses);
    window.slice._mode = resolvedMode;

     // Initialize bundles before building components.
     // Only in production — dev mode loads each component individually from source.
     // bundleConfigJson was already fetched above (step 2); reuse it.
     try {
        if (resolvedMode === 'production' && bundleConfigJson) {
           window.slice.controller.bundleConfig = bundleConfigJson;
        }

       if (window.slice.controller.bundleConfig) {
          const config = window.slice.controller.bundleConfig;

          const criticalFile = config?.bundles?.critical?.file;
           if (criticalFile) {
              // Bundle auto-registers itself on import via its own registration block.
              // The block pushes its registerBundle() Promise to window.__slicePendingRegistrations
              // so we can await full chunk processing before continuing to build('Loading').
              await import(`/bundles/${criticalFile}`);
              if (window.__slicePendingRegistrations?.length) {
                 await Promise.all(window.__slicePendingRegistrations);
                 window.__slicePendingRegistrations = [];
              }
           }

          const routeBundles = config?.routeBundles || {};
          const initialPath = window.location.pathname || '/';
          const bundlesForRoute = routeBundles[initialPath] || [];

          const loadRouteBundles = async () => {
             for (const bundleName of bundlesForRoute) {
                if (bundleName === 'critical') continue;
                const bundleInfo = config?.bundles?.routes?.[bundleName];
                if (!bundleInfo?.file) continue;
                // Bundle auto-registers itself on import.
                await import(`/bundles/${bundleInfo.file}`);
             }
          };

          if (typeof requestIdleCallback === 'function') {
             requestIdleCallback(() => loadRouteBundles());
          } else {
             setTimeout(() => loadRouteBundles(), 0);
          }
       }
    } catch (error) {
       console.log('📄 Using individual component loading (no bundles found)');
    }

   slice.paths.structuralComponentFolderPath = '/Slice/Components/Structural';

    if (sliceConfig.logger.enabled) {
       const LoggerModule = window.slice.frameworkClasses?.Logger
         || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Logger/Logger.js`);
       window.slice.logger = new LoggerModule();
   } else {
      window.slice.logger = {
         logError: () => {},
         logWarning: () => {},
         logInfo: () => {},
      };
   }

    if (sliceConfig.debugger.enabled) {
        const DebuggerModule = window.slice.frameworkClasses?.Debugger
           || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Debugger/Debugger.js`);
        window.slice.debugger = new DebuggerModule();
       await window.slice.debugger.enableDebugMode();
       document.body.appendChild(window.slice.debugger);
   }

     if (sliceConfig.events?.ui?.enabled) {
        const EventsDebuggerModule = window.slice.frameworkClasses?.EventManagerDebugger
           || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/EventManager/EventManagerDebugger.js`);
        window.slice.eventsDebugger = new EventsDebuggerModule();
       await window.slice.eventsDebugger.init();
       document.body.appendChild(window.slice.eventsDebugger);
    }

     if (sliceConfig.context?.ui?.enabled) {
        const ContextDebuggerModule = window.slice.frameworkClasses?.ContextManagerDebugger
           || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/ContextManager/ContextManagerDebugger.js`);
        window.slice.contextDebugger = new ContextDebuggerModule();
       await window.slice.contextDebugger.init();
       document.body.appendChild(window.slice.contextDebugger);
    }

    if (sliceConfig.events?.enabled) {
       const EventManagerModule = window.slice.frameworkClasses?.EventManager
          || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/EventManager/EventManager.js`);
      window.slice.events = new EventManagerModule();
      if (typeof window.slice.events.init === 'function') {
         await window.slice.events.init();
      }
   } else {
      window.slice.events = {
         subscribe: () => null,
         subscribeOnce: () => null,
         unsubscribe: () => false,
         emit: () => {},
         bind: () => ({
            subscribe: () => null,
            subscribeOnce: () => null,
            emit: () => {},
         }),
         cleanupComponent: () => 0,
         hasSubscribers: () => false,
         subscriberCount: () => 0,
         clear: () => {},
      };
      window.slice.logger.logError('Slice', 'EventManager disabled');
   }

    if (sliceConfig.context?.enabled) {
       const ContextManagerModule = window.slice.frameworkClasses?.ContextManager
          || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/ContextManager/ContextManager.js`);
      window.slice.context = new ContextManagerModule();
      if (typeof window.slice.context.init === 'function') {
         await window.slice.context.init();
      }
   } else {
      window.slice.context = {
         create: () => false,
         getState: () => null,
         setState: () => {},
         watch: () => null,
         has: () => false,
         destroy: () => false,
         list: () => [],
      };
      window.slice.logger.logError('Slice', 'ContextManager disabled');
   }

    if (sliceConfig.loading.enabled) {
      const loading = await window.slice.build('Loading', {});
      window.slice.loading = loading;
      if (typeof loading?.start === 'function') {
         loading.start();
      }
    }

   await window.slice.stylesManager.init();

   if (sliceConfig.events?.ui?.shortcut || sliceConfig.context?.ui?.shortcut) {
      const normalize = (value) => (typeof value === 'string' ? value.toLowerCase() : '');
      const toKey = (event) => {
         const parts = [];
         if (event.ctrlKey) parts.push('ctrl');
         if (event.shiftKey) parts.push('shift');
         if (event.altKey) parts.push('alt');
         if (event.metaKey) parts.push('meta');
         const key = event.key?.toLowerCase();
         if (key && !['control', 'shift', 'alt', 'meta'].includes(key)) {
            parts.push(key);
         }
         return parts.join('+');
      };

      const handlers = {
         [normalize(sliceConfig.events?.ui?.shortcut)]: () => window.slice.eventsDebugger?.toggle?.(),
         [normalize(sliceConfig.context?.ui?.shortcut)]: () => window.slice.contextDebugger?.toggle?.(),
      };

      document.addEventListener('keydown', (event) => {
         const key = toKey(event);
         if (!key || !handlers[key]) return;
         event.preventDefault();
         handlers[key]();
      });
   }

   const routesModule = await import(slice.paths.routesFile);
   const routes = routesModule.default;
    const RouterModule = window.slice.frameworkClasses?.Router
       || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Router/Router.js`);
    window.slice.router = new RouterModule(routes);
   await window.slice.router.init();
}

 await init();
