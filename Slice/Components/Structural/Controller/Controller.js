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

  logActiveComponents() {
    this.activeComponents.forEach(component => {
      let parent = component.parentComponent;
      let parentName = parent ? parent.constructor.name : null;
      console.log(`${component.constructor.name} - Parent: ${parentName}`);
    });
  }

  getTopParentsLinkedToActiveComponents() {
    let topParentsLinkedToActiveComponents = new Map();
    this.activeComponents.forEach(component => {
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

    if (htmlId && htmlId.trim() !== "") {
      if (this.activeComponents.has(htmlId)) {
        slice.logger.logError(
          "Controller",
          `A component with the same html id attribute is already registered: ${htmlId}`
        );
        return false;
      }
    }

    let sliceId = component.sliceId;

    if (sliceId && sliceId.trim() !== "") {
      if (this.activeComponents.has(sliceId)) {
        slice.logger.logError(
          "Controller",
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
    component.querySelectorAll('*').forEach(child => {
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

  async fetchText(componentName, fileType, componentBasePath, componentCategory) {
    if (!componentCategory) {
      componentCategory = this.componentCategories.get(componentName);
    }
  
    if (!componentBasePath && fileType !== "theme" && fileType !== "styles") {
      if (componentCategory.includes("User")) {
        componentBasePath = slice.paths.userComponents;
      } else {
        componentBasePath = slice.paths.components;
      }
    }
  
    const baseUrl = window.location.origin;  // Base URL of the server
    let path;
  
    if (fileType === "css") {
      path = `${baseUrl}/${componentBasePath}/${componentCategory}/${componentName}/${componentName}.css`;
    }
  
    if (fileType === "html") {
      path = `${baseUrl}/${componentBasePath}/${componentCategory}/${componentName}/${componentName}.html`;
    }
  
    if (fileType === "theme") {
      path = `${baseUrl}/Slice/${slice.paths.themes}/${componentName}.css`;
    }
  
    if (fileType === "styles") {
      path = `${baseUrl}/Slice/${slice.paths.styles}/${componentName}.css`;
    }
  
    console.log(`Fetching: ${path}`);
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
    }
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

function getRelativePath(levels) {
  return '../'.repeat(levels);
}