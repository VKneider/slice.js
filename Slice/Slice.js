import Logger from "./Components/Structural/Logger/Logger.js";
import Controller from "./Components/Structural/Controller/Controller.js";
import StylesManager from "./Components/Structural/StylesManager/StylesManager.js";
import Debugger from "./Components/Structural/Debugger/Debugger.js";
import sliceConfig from "./sliceConfig.json" assert { type: "json" };

export default class Slice {
  constructor() {
    this.logger = new Logger();
    this.controller = new Controller();
    this.stylesManager = new StylesManager();
    this.paths = sliceConfig.paths;

    this.getClass = async function getClass(module) {
      try {
        const { default: myClass } = await import(module);
        return await myClass;
      } catch (error) {
        this.logger.logError("Slice", `Error loading class ${module}`, error);
      }
    };
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

    if (!this.controller.componentCategories.has(componentName)) {
      this.logger.logError(
        "Slice",
        null,
        `Component ${componentName} not found in components.js file`
      );
      return null;
    }

    let compontentCategory =
      this.controller.componentCategories.get(componentName);

    //Pregunta para la posteridad: ¿Deberíamos dejar que el usuario pueda crear componentes de categoría Structural?
    //Por ahora no lo permitimos, pero si en el futuro se decide que sí, se debe cambiar el código de abajo para que funcione
    //con componentes de categoría Structural

    if (compontentCategory === "Structural") {
      this.logger.logError(
        "Slice",
        null,
        `Component ${componentName} is a Structural component and cannot be built`
      );
      return null;
    }

    const isVisual = compontentCategory === "Visual";

    let modulePath = `${this.paths.components}/${compontentCategory}/${componentName}/${componentName}.js`;

    // Load template if not loaded previously and component category is Visual
    if (!this.controller.templates.has(componentName) && isVisual) {
      try {
        const html = await this.controller.fetchText(componentName, "html");
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
        const css = await this.controller.fetchText(componentName, "css");
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

      if (componentIds.id) componentInstance.id = componentIds.id;
      if (componentIds.sliceId)
        componentInstance.sliceId = componentIds.sliceId;

      this.stylesManager.handleInstanceStyles(componentInstance, props);

      if (!this.controller.registerComponent(componentInstance)) {
        this.logger.logError(
          "Slice",
          `Error registering instance ${componentName} ${componentInstance.sliceId}`
        );
        return null;
      }

      if (this.debugger.enabled && compontentCategory === "Visual") {
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

  setPaths(paths) {
    this.paths = paths;
  }

  setTheme(themeName) {
    this.stylesManager.setTheme(themeName);
  }

  attachTemplate(componentInstance) {
    this.controller.loadTemplateToComponent(componentInstance);
  }
}

async function init() {
  window.slice = new Slice();
  window.slice.debugger = new Debugger();

  if (window.slice.debugger.enabled) {
    await window.slice.debugger.enableDebugMode();
    document.body.appendChild(window.slice.debugger);
  }

  if (sliceConfig.translator.enabled) {
    const { default:translatorModule } = await import(
      `${sliceConfig.paths.components}/Structural/Translator/Translator.js`
    );
    window.slice.translator = new translatorModule();
    window.slice.logger.logInfo("Slice", "Translator succesfuly enabled");

  }

  await window.slice.stylesManager.setTheme(
    sliceConfig.stylesManager.defaultTheme
  );
}

init();
