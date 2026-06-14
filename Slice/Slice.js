
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
      this._publicEnv = {};

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
         this.logger.error('Slice', `Error loading class ${module}`, error);
         throw error;
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

   setPublicEnv(envPayload = {}) {
      const normalized = {};

      for (const [key, value] of Object.entries(envPayload || {})) {
         if (!key.startsWith('SLICE_PUBLIC_')) continue;
         normalized[key] = String(value ?? '');
      }

      this._publicEnv = normalized;
   }

   getEnv(name, fallbackValue = undefined) {
      if (!name || typeof name !== 'string') {
         return fallbackValue;
      }

      if (Object.prototype.hasOwnProperty.call(this._publicEnv, name)) {
         return this._publicEnv[name];
      }

      return fallbackValue;
   }

   getPublicEnv() {
      return { ...this._publicEnv };
   }

   /**
    * Typed accessors over the public env, so callers stop re-parsing strings.
    *   slice.env.get('SLICE_PUBLIC_API_URL', '')
    *   slice.env.bool('SLICE_PUBLIC_AUTH_ENABLED')   // '1'|'true'|'yes'|'on' → true
    *   slice.env.int('SLICE_PUBLIC_TIMEOUT', 5000)
    *   slice.env.list('SLICE_PUBLIC_MODELS')         // 'a, b' → ['a','b']
    *   slice.env.has('X')  /  slice.env.all()
    * @returns {{ get: Function, has: Function, all: Function, bool: Function, int: Function, list: Function }}
    */
   get env() {
      const read = (name) =>
         Object.prototype.hasOwnProperty.call(this._publicEnv, name) ? this._publicEnv[name] : undefined;
      const present = (v) => v !== undefined && String(v).trim() !== '';

      return {
         get: (name, fallback = undefined) => this.getEnv(name, fallback),
         has: (name) => Object.prototype.hasOwnProperty.call(this._publicEnv, name),
         all: () => this.getPublicEnv(),
         bool: (name, fallback = false) => {
            const v = read(name);
            return present(v) ? ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase()) : fallback;
         },
         int: (name, fallback = 0) => {
            const v = read(name);
            const n = parseInt(v, 10);
            return Number.isNaN(n) ? fallback : n;
         },
         list: (name, fallback = []) => {
            const v = read(name);
            if (!present(v)) return fallback;
            return String(v)
               .split(',')
               .map((s) => s.trim())
               .filter(Boolean);
         },
      };
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
    *
    * Pass `{ singleton: true }` to get-or-create one shared instance keyed by
    * `sliceId` (defaults to `componentName`). Concurrent singleton builds of the
    * same id share a single in-flight build, so they never race on a duplicate
    * sliceId. Singletons are only supported for Service components — for app-wide
    * UI build a Provider Service that manages the Visual (see ToastProvider /
    * ToolTipProvider), because a DOM node can only live in one place.
    *
    * Note: `props` only apply on the first (creating) call; later calls return
    * the existing instance and ignore them.
    *
    * @param {string} componentName
    * @param {Object} [props]
    * @param {boolean} [props.singleton] Reuse a single instance per sliceId.
    * @returns {Promise<HTMLElement|Object|null>}
    */
   async build(componentName, props = {}) {
      if (!props || props.singleton !== true) {
         return this._build(componentName, props);
      }

      const { singleton, ...rest } = props;
      const sliceId = rest.sliceId || componentName;

      // Singletons are allowed for any category whose *type* is 'Service' — not
      // only the built-in 'Service' category. Custom categories declared in
      // sliceConfig with `"type": "Service"` (e.g. AppServices) are services too.
      const category = this.controller.componentCategories.get(componentName);
      const categoryType = slice.paths?.components?.[category]?.type;
      if (categoryType !== 'Service') {
         this.logger.logError(
            'Slice',
            `singleton:true is only supported for Service-type components ('${componentName}' is in category '${category || 'unknown'}', type '${categoryType || 'unknown'}'). ` +
               `For app-wide UI build a Provider Service that manages the Visual (see ToastProvider/ToolTipProvider).`
         );
         return null;
      }

      return this.controller.getOrCreate(sliceId, () =>
         this._build(componentName, { ...rest, sliceId })
      );
   }

   /**
    * Internal build: load resources, construct, run init, register. Always
    * creates a new instance. Public `build` delegates here (and wraps it with
    * get-or-create when `singleton:true`).
    * @param {string} componentName
    * @param {Object} [props]
    * @returns {Promise<HTMLElement|Object|null>}
    */
   async _build(componentName, props = {}) {
      if (!componentName) {
         this.logger.error('Slice', 'Component name is required to build a component');
         return null;
      }

      if (typeof componentName !== 'string') {
         this.logger.error('Slice', 'Component name must be a string');
         return null;
      }

      // 📦 Try to load from bundles first
      const bundleName = this.controller.getBundleForComponent(componentName);
      if (bundleName && !this.controller.loadedBundles.has(bundleName)) {
         await this.controller.loadBundle(bundleName);
      }

      if (!this.controller.componentCategories.has(componentName) && !this.controller.classes.has(componentName)) {
         this.logger.error('Slice', `Component ${componentName} not found in components.js file`);
         return null;
      }

      let componentCategory = this.controller.componentCategories.get(componentName);
      if (!componentCategory && this.controller.classes.has(componentName)) {
         componentCategory = 'AppComponents';
      }

      // 📦 Check if component is already available from loaded bundles
      const isFromBundle = this.controller.isComponentFromBundle(componentName);

      if (componentCategory === 'Structural') {
         this.logger.error('Slice', `Component ${componentName} is a Structural component and cannot be built`);
         return null;
      }

      let isVisual = slice.paths.components[componentCategory]?.type === 'Visual';
      let modulePath = `${slice.paths.components[componentCategory].path}/${componentName}/${componentName}.js`;
      const isJsOnlyVisualComponent = isVisual && (componentName === 'MultiRoute' || componentName === 'Route');

      // Load template, class, and CSS concurrently if needed
      try {
         // 📦 Skip individual loading if component is available from bundles
          const loadTemplate =
             isFromBundle || !isVisual || isJsOnlyVisualComponent || this.controller.templates.has(componentName)
                ? Promise.resolve(null)
                : this.controller.fetchText(componentName, 'html', componentCategory);

         const loadClass =
            isFromBundle || this.controller.classes.has(componentName)
               ? Promise.resolve(null)
               : this.getClass(modulePath);

          const loadCSS =
             isFromBundle || !isVisual || isJsOnlyVisualComponent || this.controller.requestedStyles.has(componentName)
                ? Promise.resolve(null)
                : this.controller.fetchText(componentName, 'css', componentCategory);

         const [html, ComponentClass, css] = await Promise.all([loadTemplate, loadClass, loadCSS]);

         // 📦 If component is from bundle but not in cache, it should have been registered by registerBundle
         if (isFromBundle) {
            this.logger.logInfo('Slice', `📦 Using bundled component: ${componentName}`);
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
         // `singleton` is a build directive (handled in the public build()
         // wrapper). Strip it here too so it is consistently reserved and never
         // leaks into a component's props on the non-singleton path.
         delete props.singleton;

       const ComponentClass = this.controller.classes.get(componentName);
       this.logger.logInfo(
          'Slice',
          `🔎 Build component: ${componentName} (classType: ${typeof ComponentClass}, isFunction: ${typeof ComponentClass === 'function'})`
       );
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
      const response = await fetch('/sliceConfig.json');
      if (!response.ok) throw new Error('Error loading sliceConfig.json');
      const json = await response.json();
      return json;
   } catch (error) {
      console.error('Error loading config file:', error);
      return null;
   }
}

async function init() {
   const sliceConfig = await loadConfig();
   if (!sliceConfig) {
      console.error('%c\u26A0\uFE0F Error loading Slice configuration', 'color: red; font-size: 20px;');
      alert('Error loading Slice configuration');
      throw new Error('Slice initialization failed: unable to load sliceConfig.json');
   }

    // 1+2. Fetch mode endpoint and bundle config in parallel — both are independent.
    // In production, /slice-env.json returns 404 (catch is expected and normal).
    // bundleConfigJson.production serves as a mode fallback when env endpoint is absent.
    let frameworkClasses = null;
    const [envResult, configResult] = await Promise.all([
      fetch('/slice-env.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(error => { console.error('[Slice.js] Error fetching /slice-env.json:', error); return null; }),
      fetch('/bundles/bundle.config.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(error => { console.error('[Slice.js] Error fetching bundle.config.json:', error); return null; })
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
          console.error('[Slice.js] framework bundle import failed, falling through to individual imports:', e);
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
          console.error('[Slice.js] individual imports fallback failed:', e);
          throw e;
        }
     }

    // 5. Create Slice instance and set resolved mode
    window.slice = new Slice(sliceConfig, frameworkClasses);
    window.slice._mode = resolvedMode;
    window.slice.setPublicEnv(envResult?.env || {});

     const createBundlingInitError = (step, error) => {
        const detail = error instanceof Error ? error.message : String(error);
        return new Error(`Bundling V2 initialization failed (${step}): ${detail}`, { cause: error });
     };

     // Initialize bundles before building components.
     // Only in production — dev mode loads each component individually from source.
     // bundleConfigJson was already fetched above (step 2); reuse it.
     if (resolvedMode === 'production' && bundleConfigJson) {
        window.slice.controller.bundleConfig = bundleConfigJson;
     }

     if (resolvedMode === 'production' && window.slice.controller.bundleConfig) {
        const config = window.slice.controller.bundleConfig;
        if (!window.__SLICE_SHARED_DEPS__ || typeof window.__SLICE_SHARED_DEPS__ !== 'object') {
           window.__SLICE_SHARED_DEPS__ = {};
        }
        const criticalFile = config?.bundles?.critical?.file;
        if (criticalFile) {
           try {
              await window.slice.controller.loadBundle('critical');
           } catch (error) {
              throw createBundlingInitError(`critical bundle "${criticalFile}"`, error);
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
              await window.slice.controller.loadBundle(bundleName);
           }
        };

        const preloadRouteBundles = () => {
           loadRouteBundles().catch((error) => {
              window.slice?.logger?.error('Slice', `Idle route preload failed for "${initialPath}"`, error);
           });
        };

        const safePreload = () => {
           try {
              preloadRouteBundles();
           } catch (error) {
              window.slice?.logger?.error('Slice', 'Error in route preload callback', error);
           }
        };

        if (typeof requestIdleCallback === 'function') {
           requestIdleCallback(() => safePreload());
        } else {
           setTimeout(() => safePreload(), 0);
        }
     }

   slice.paths.structuralComponentFolderPath = '/Slice/Components/Structural';

    if (sliceConfig.logger.enabled) {
       const LoggerModule = window.slice.frameworkClasses?.Logger
         || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Logger/Logger.js`);
       window.slice.logger = new LoggerModule();
   } else {
      const noop = () => {};
      window.slice.logger = {
         error: noop, warn: noop, info: noop, debug: noop,
         logError: noop, logWarning: noop, logInfo: noop,
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

      if (sliceConfig.logger?.ui?.enabled) {
         try {
            const LogViewerModule = window.slice.frameworkClasses?.LogViewer
               || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Logger/LogViewer/LogViewer.js`);
            const logViewer = new LogViewerModule();
            window.slice.logViewer = logViewer;
            logViewer.style.display = 'none';
            document.body.appendChild(logViewer);
            if (typeof logViewer.init === 'function') logViewer.init();
         } catch (e) {
            window.slice.logger?.warn?.('Slice', 'Could not load LogViewer component', e);
         }
      }

     if (sliceConfig.loading.enabled) {
       const loading = await window.slice.build('Loading', {});
       window.slice.loading = loading;
      if (typeof loading?.start === 'function') {
         loading.start();
      }
    }

   const stylesInitPromise = window.slice.stylesManager.init();
   const routesModulePromise = import(slice.paths.routesFile);

   if (sliceConfig.events?.ui?.shortcut || sliceConfig.context?.ui?.shortcut || sliceConfig.logger?.ui?.shortcut) {
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
         [normalize(sliceConfig.logger?.ui?.shortcut)]: () => window.slice.logViewer?.toggle?.(),
      };

      document.addEventListener('keydown', (event) => {
         const key = toKey(event);
         if (!key || !handlers[key]) return;
         event.preventDefault();
         handlers[key]();
      });
   }

   const [, routesModule] = await Promise.all([stylesInitPromise, routesModulePromise]);
   const routes = routesModule.default;
    const RouterModule = window.slice.frameworkClasses?.Router
       || await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Router/Router.js`);
    window.slice.router = new RouterModule(routes);
   await window.slice.router.init();
}

 try {
   await init();
} catch (initError) {
   console.error('[Slice.js] Initialization failed:', initError);
 }
