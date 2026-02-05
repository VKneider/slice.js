import Controller from './Components/Structural/Controller/Controller.js';
import StylesManager from './Components/Structural/StylesManager/StylesManager.js';

/**
 * Main Slice.js runtime.
 */
export default class Slice {
   /**
    * @param {Object} sliceConfig
    */
   constructor(sliceConfig) {
      this.controller = new Controller();
      this.stylesManager = new StylesManager();
      this.paths = sliceConfig.paths;
      this.themeConfig = sliceConfig.themeManager;
      this.stylesConfig = sliceConfig.stylesManager;
      this.loggerConfig = sliceConfig.logger;
      this.debuggerConfig = sliceConfig.debugger;
      this.loadingConfig = sliceConfig.loading;
      this.eventsConfig = sliceConfig.events;

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
    * Flag for production behavior (override in builds).
    * @returns {boolean}
    */
   isProduction() {
      return true;
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
      console.log(json);
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

   window.slice = new Slice(sliceConfig);

   slice.paths.structuralComponentFolderPath = '/Slice/Components/Structural';

   if (sliceConfig.logger.enabled) {
      const LoggerModule = await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Logger/Logger.js`);
      window.slice.logger = new LoggerModule();
   } else {
      window.slice.logger = {
         logError: () => {},
         logWarning: () => {},
         logInfo: () => {},
      };
   }

   if (sliceConfig.debugger.enabled) {
       const DebuggerModule = await window.slice.getClass(
          `${slice.paths.structuralComponentFolderPath}/Debugger/Debugger.js`
       );
       window.slice.debugger = new DebuggerModule();
       await window.slice.debugger.enableDebugMode();
       document.body.appendChild(window.slice.debugger);
   }

    if (sliceConfig.events?.ui?.enabled) {
       const EventsDebuggerModule = await window.slice.getClass(
          `${slice.paths.structuralComponentFolderPath}/EventManager/EventManagerDebugger.js`
       );
       window.slice.eventsDebugger = new EventsDebuggerModule();
       await window.slice.eventsDebugger.init();
       document.body.appendChild(window.slice.eventsDebugger);
    }

    if (sliceConfig.context?.ui?.enabled) {
       const ContextDebuggerModule = await window.slice.getClass(
          `${slice.paths.structuralComponentFolderPath}/ContextManager/ContextManagerDebugger.js`
       );
       window.slice.contextDebugger = new ContextDebuggerModule();
       await window.slice.contextDebugger.init();
       document.body.appendChild(window.slice.contextDebugger);
    }

   if (sliceConfig.events?.enabled) {
      const EventManagerModule = await window.slice.getClass(
         `${slice.paths.structuralComponentFolderPath}/EventManager/EventManager.js`
      );
      window.slice.events = new EventManagerModule();
      if (typeof window.slice.events.init === 'function') {
         await window.slice.events.init();
      }
      window.slice.logger.logError('Slice', 'EventManager enabled');
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
      const ContextManagerModule = await window.slice.getClass(
         `${slice.paths.structuralComponentFolderPath}/ContextManager/ContextManager.js`
      );
      window.slice.context = new ContextManagerModule();
      if (typeof window.slice.context.init === 'function') {
         await window.slice.context.init();
      }
      window.slice.logger.logError('Slice', 'ContextManager enabled');
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
   const RouterModule = await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Router/Router.js`);
   window.slice.router = new RouterModule(routes);
   await window.slice.router.init();
}

await init();

// Initialize bundles if available
try {
   const { initializeBundles } = await import('/bundles/bundle.config.js');
   if (initializeBundles) {
      await initializeBundles(window.slice);
      console.log('📦 Bundles initialized automatically');
   }
} catch (error) {
   // Bundles not available, continue with individual component loading
   console.log('📄 Using individual component loading (no bundles found)');
}
