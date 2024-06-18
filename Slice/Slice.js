import Controller from "./Components/Structural/Controller/Controller.js";
import StylesManager from "./Components/Structural/StylesManager/StylesManager.js";
import sliceConfig from "./sliceConfig.json" with { type: "json" };

export default class Slice {
  constructor() {
    this.controller = new Controller();
    this.stylesManager = new StylesManager();
    this.paths = sliceConfig.paths;
    this.themeConfig = sliceConfig.stylesManager;
  }

  async getClass(module) {
    try {
      const { default: myClass } = await import(module);
      return await myClass;
    } catch (error) {
      this.logger.logError("Slice", `Error loading class ${module}`, error);
    }
  }

  async build(componentName, props = {}) {
    if (!componentName) {
      this.logger.logError(
        "Slice",
        null,
        `Component name is required to build a component`
      );
      return null;
    }

    if (typeof componentName !== "string") {
      this.logger.logError(
        "Slice",
        null,
        `Component name must be a string`
      );
      return null;
    }

    if (!this.controller.componentCategories.has(componentName)) {
      this.logger.logError(
        "Slice",
        null,
        `Component ${componentName} not found in components.js file`
      );
      return null;
    }

    let componentCategory = this.controller.componentCategories.get(componentName);

    if (componentCategory === "Structural") {
      this.logger.logError(
        "Slice",
        null,
        `Component ${componentName} is a Structural component and cannot be built`
      );
      return null;
    }

    let componentBasePath;

    if (componentCategory.includes("User")) {
      componentCategory = componentCategory.replace("User", "")
      componentBasePath = this.paths.userComponents
    } else {
      componentBasePath = this.paths.components
    }

    const isVisual = componentCategory === "Visual";
    let modulePath = `${componentBasePath}/${componentCategory}/${componentName}/${componentName}.js`;

    // Load template if not loaded previously and component category is Visual
    if (!this.controller.templates.has(componentName) && isVisual) {
      try {
        const html = await this.controller.fetchText(componentName, "html", componentBasePath, componentCategory);
        const template = document.createElement("template");
        template.innerHTML = html;
        this.controller.templates.set(componentName, template);
        this.logger.logInfo("Slice", `Template ${componentName} loaded`);
      } catch (error) {
        console.log(error);
        this.logger.logError(
          "Slice",
          `Error loading template ${componentName}`,
          error
        );
      }
    }

    //Load class if not loaded previously
    if (!this.controller.classes.has(componentName)) {
      try {
        const ComponentClass = await this.getClass(modulePath);
        this.controller.classes.set(componentName, ComponentClass);
        this.logger.logInfo("Slice", `Class ${componentName} loaded`);
      } catch (error) {
        console.log(error);
        this.logger.logError(
          "Slice",
          `Error loading class ${modulePath}`,
          error
        );
      }
    }

    //Load css if not loaded previously and component category is Visual
    if (!this.controller.requestedStyles.has(componentName) && isVisual) {
      try {
        const css = await this.controller.fetchText(componentName, "css", componentBasePath, componentCategory);
        this.stylesManager.registerComponentStyles(componentName, css);
        this.logger.logInfo("Slice", `CSS ${componentName} loaded`);
      } catch (error) {
        console.log(error);
        this.logger.logError(
          "Slice",
          `Error loading css ${componentName}`,
          error
        );
      }
    }

    //Create instance
    try {
      let componentIds = {};
      if (props.id) componentIds.id = props.id;
      if (props.sliceId) componentIds.sliceId = props.sliceId;

      delete props.id;
      delete props.sliceId;

      const ComponentClass = this.controller.classes.get(componentName);
      const componentInstance = new ComponentClass(props);

      if (componentIds.id && isVisual) componentInstance.id = componentIds.id;
      if (componentIds.sliceId)
        componentInstance.sliceId = componentIds.sliceId;


      if (!this.controller.registerComponent(componentInstance)) {
        this.logger.logError(
          "Slice",
          `Error registering instance ${componentName} ${componentInstance.sliceId}`
        );
        return null;
      }

      if (sliceConfig.debugger.enabled && componentCategory === "Visual") {
        this.debugger.attachDebugMode(componentInstance);
      }

      //if the component has a method called init, call it
      if (componentInstance.init) await componentInstance.init();

      this.logger.logInfo(
        "Slice",
        `Instance ${componentInstance.sliceId} created`
      );
      return componentInstance;
    } catch (error) {
      console.log(error);
      this.logger.logError(
        "Slice",
        `Error creating instance ${componentName}`,
        error
      );
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

async function init() {
  window.slice = new Slice();

  if(sliceConfig.logger.enabled){
    const LoggerModule = await window.slice.getClass( `${sliceConfig.paths.components}/Structural/Logger/Logger.js`);
    window.slice.logger = new LoggerModule();
  }else {
    window.slice.logger = {
      logError: () => {},
      logWarning: () => {},
      logInfo: () => {},
  };
  }

  if (sliceConfig.debugger.enabled) {
    const DebuggerModule = await window.slice.getClass(
      `${sliceConfig.paths.components}/Structural/Debugger/Debugger.js`
    );
    window.slice.debugger = new DebuggerModule();
    await window.slice.debugger.enableDebugMode();
    document.body.appendChild(window.slice.debugger);
  }

  if (sliceConfig.translator.enabled) {
    const translator = await window.slice.build("Translator");
    window.slice.translator = translator;
    window.slice.logger.logInfo("Slice", "Translator succesfuly enabled");
  }

  await window.slice.stylesManager.init();
}

await init();
