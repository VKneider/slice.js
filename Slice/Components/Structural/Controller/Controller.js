import components from "../../components.js";

export default class Controller {
    constructor() {
        this.componentCategories = new Map(Object.entries(components));
        this.templates = new Map();
        this.classes = new Map();
        this.activeComponents = new Map();
        this.idCounter = 0;

    }

    registerComponent(component) {
        const htmlId = component.id;
        
        if (htmlId && htmlId.trim() !== ""){
            if (this.activeComponents.has(htmlId)) {
                slice.logger.logError("Controller", `A component with the same html id attribute is already registered: ${htmlId}`);
                return null;
            }
        }

        let sliceId = component.sliceId;

        if (sliceId && sliceId.trim() !== ""){
            if (this.activeComponents.has(sliceId)) {
                slice.logger.logError("Controller", `A component with the same slice id attribute is already registered: ${sliceId}`);
                return null;
            }
        }else {
            sliceId = `slice-${this.idCounter}`;
            component.sliceId = sliceId;
            this.idCounter++;
        }
        
        this.activeComponents.set(sliceId, component);
        return true;
        
    }

    getComponent(id) {
        return this.activeComponents.get(id);
    }

    //Attach template to component
    loadTemplateToComponent(component) {
        const className = component.constructor.name;
        const template = this.templates.get(className);
        
        if (!template) {
            console.error(`Template not found for component: ${className}`);
            return;
        }
        
        component.innerHTML = template.innerHTML;
        return component;
    }


    getComponentCategory(componentSliceId){
        return this.componentCategories.get(componentSliceId);
    }

    async fetchHtml(componentName){

        const componentCategory = this.getComponentCategory(componentName);
        const templatePath = `Slice/${slice.paths.components}/${componentCategory}/${componentName}/${componentName}.html`;
        const response = await fetch(templatePath);
        const html = await response.text();
        return html;
        
    }


}
