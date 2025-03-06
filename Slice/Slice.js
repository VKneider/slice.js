import Controller from './Components/Structural/Controller/Controller.js';
import StylesManager from './Components/Structural/StylesManager/StylesManager.js';

export default class Slice {
   constructor(sliceConfig) {
      this.controller = new Controller();
      this.stylesManager = new StylesManager();
      this.paths = sliceConfig.paths;
      this.themeConfig = sliceConfig.themeManager;
      this.stylesConfig = sliceConfig.stylesManager;
      this.loggerConfig = sliceConfig.logger;
      this.debuggerConfig = sliceConfig.debugger;
      this.loadingConfig = sliceConfig.loading;
   }

   async getClass(module) {
      try {
         const { default: myClass } = await import(module);
         return await myClass;
      } catch (error) {
         this.logger.logError('Slice', `Error loading class ${module}`, error);
      }
   }

   getComponent(componentSliceId) {
      return this.controller.activeComponents.get(componentSliceId);
   }

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

      let componentCategory = this.controller.componentCategories.get(componentName);

      if (componentCategory === 'Structural') {
         this.logger.logError(
            'Slice',
            null,
            `Component ${componentName} is a Structural component and cannot be built`
         );
         return null;
      }

      let isVisual = slice.paths.components[componentCategory].type === "Visual";     
      let modulePath = `${slice.paths.components[componentCategory].path}/${componentName}/${componentName}.js`;

      // Load template, class, and CSS concurrently if needed
      try {
         const loadTemplate =
            isVisual && !this.controller.templates.has(componentName)
               ? this.controller.fetchText(componentName, 'html', componentCategory)
               : Promise.resolve(null);

         const loadClass = !this.controller.classes.has(componentName)
            ? this.getClass(modulePath)
            : Promise.resolve(null);

         const loadCSS =
            isVisual && !this.controller.requestedStyles.has(componentName)
               ? this.controller.fetchText(componentName, 'css', componentCategory)
               : Promise.resolve(null);

         const [html, ComponentClass, css] = await Promise.all([loadTemplate, loadClass, loadCSS]);

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
         this.controller.registerComponentsRecursively(componentInstance);

         this.logger.logInfo('Slice', `Instance ${componentInstance.sliceId} created`);
         return componentInstance;
      } catch (error) {
         console.log(error);
         this.logger.logError('Slice', `Error creating instance ${componentName}`, error);
         return null;
      }
   }

   async setTheme(themeName) {
      await this.stylesManager.themeManager.applyTheme(themeName);
   }

   get theme() {
      return this.stylesManager.themeManager.currentTheme;
   }

   attachTemplate(componentInstance) {
      this.controller.loadTemplateToComponent(componentInstance);
   }

   
}


async function loadConfig(){
   try {
      const response = await fetch('/sliceConfig.json'); // 🔹 Express lo sirve desde `src/`
      if (!response.ok) throw new Error('Error loading sliceConfig.json');
      const json = await response.json();
      console.log(json)
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

   slice.paths.structuralComponentFolderPath = "/Slice/Components/Structural"; 

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

   if (sliceConfig.loading.enabled) {
      const loading = await window.slice.build('Loading', {});
      window.slice.loading = loading;
   }
   await window.slice.stylesManager.init();


   const routesModule = await import(slice.paths.routesFile);
   const routes = routesModule.default;
   const RouterModule = await window.slice.getClass(`${slice.paths.structuralComponentFolderPath}/Router/Router.js`);
   window.slice.router = new RouterModule(routes);
   await window.slice.router.init();
   

   if (sliceConfig.translator.enabled) {
      const translator = await window.slice.build('Translator');
      window.slice.translator = translator;
      window.slice.logger.logInfo('Slice', 'Translator succesfuly enabled');
   }


}

await init();
