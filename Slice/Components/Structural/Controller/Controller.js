import components from "../../components.js";

export default class Controller {
  constructor() {
    this.componentCategories = new Map(Object.entries(components));
    this.templates = new Map();
    this.classes = new Map();
    this.requestedStyles = new Set();
    this.activeComponents = new Map();
    this.idCounter = 0;
  }

  registerComponent(component) {
    const htmlId = component.id;

    if (htmlId && htmlId.trim() !== "") {
      if (this.activeComponents.has(htmlId)) {
        slice.logger.logError(
          "Controller",
          `A component with the same html id attribute is already registered: ${htmlId}`
        );
        return null;
      }
    }

    let sliceId = component.sliceId;

    if (sliceId && sliceId.trim() !== "") {
      if (this.activeComponents.has(sliceId)) {
        slice.logger.logError(
          "Controller",
          `A component with the same slice id attribute is already registered: ${sliceId}`
        );
        return null;
      }
    } else {
        sliceId = `${component.constructor.name[0].toLowerCase()}${component.constructor.name.slice(1)}-${this.idCounter}`;
        component.sliceId = sliceId;
        this.idCounter++;
    }

    this.activeComponents.set(sliceId, component);
    return true;
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

  async fetchText(componentName, fileType, componentBasePath, componentCategory) {

    if(!componentCategory) {
      componentCategory = this.componentCategories.get(componentName);
    }

    if(!componentBasePath && fileType !== "theme" && fileType !== "styles"){
      if(componentCategory.includes("User")) {componentBasePath = slice.paths.userComponents}
      else {
        componentBasePath = slice.paths.components
      }
    }

    let path;

    if (fileType === "css") {
      path = `${componentBasePath}/${componentCategory}/${componentName}/${componentName}.css`;
    }

    if (fileType === "html") {
      path = `${componentBasePath}/${componentCategory}/${componentName}/${componentName}.html`;
    }

    if (fileType === "theme") {
      path = `Slice/${slice.paths.themes}/${componentName}.css`;
    }

    if (fileType === "styles") {
      path = `Slice/${slice.paths.styles}/${componentName}.css`;
    }

    const response = await fetch(path);
    const html = await response.text();
    return html;
  }

  setComponentProps(component, props) {
    for (const prop in props) {
      component[`_${prop}`] = null;
      component[prop] = props[prop];
    }
  }

  destroyComponent(component) {
    const sliceId = component.sliceId;
    this.activeComponents.delete(sliceId);
    component.remove();
  }
}
