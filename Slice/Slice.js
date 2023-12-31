import Logger from "./Components/Structural/Logger/Logger.js";
import Controller from "./Components/Structural/Controller/Controller.js";
import StylesManager from "./Components/Structural/StylesManager/StylesManager.js";
import Debugger from "./Components/Structural/Debugger/Debugger.js";

export default class Slice {

    constructor() {
        this.logger = new Logger();
        this.controller = new Controller();
        this.stylesManager = new StylesManager();
        this.paths = {
            components: "./Components",
            themes:"./Themes"
        };
        

        this.getClass = async function getClass(module) {
            try {
                const { default: myClass } = await import(module);
                return await myClass;
            } catch (error) {
                this.logger.logError("Slice", `Error loading class ${module}`, error);
            }
        }
        
    }


    async build(componentName, props = {}) {

        if(!componentName) {
            this.logger.logError("Slice", null, `Component name is required to build a component`);
            return null;
        }

        if(!this.controller.componentCategories.has(componentName)) {
            this.logger.logError("Slice", null, `Component ${componentName} not found in components.js file`);
            return null;
        }

        let compontentCategory = this.controller.componentCategories.get(componentName);

        //Pregunta para la posteridad: ¿Deberíamos dejar que el usuario pueda crear componentes de categoría Structural?
        //Por ahora no lo permitimos, pero si en el futuro se decide que sí, se debe cambiar el código de abajo para que funcione
        //con componentes de categoría Structural

                if(compontentCategory === "Structural") {
                    this.logger.logError("Slice", null, `Component ${componentName} is a Structural component and cannot be built`);
                    return null;
                }


        const isVisual = compontentCategory === "Visual";

        let modulePath = `${this.paths.components}/${compontentCategory}/${componentName}/${componentName}.js`;

        
        // Load template if not loaded previously and component category is Visual
        if (!this.controller.templates.has(componentName) && isVisual ) {
            try {
                const html = await this.controller.fetchHtml(componentName);
                const template = document.createElement("template");
                template.innerHTML = html;
                this.controller.templates.set(componentName, template);
                this.logger.logInfo("Slice", `Template ${componentName} loaded`)
            } catch (error) {
                console.log(error)
                this.logger.logError("Slice", `Error loading template ${componentName}`, error);
            }
        }

    
        //Load class if not loaded previously 
        if (!this.controller.classes.has(componentName)) {
            try {
                const ComponentClass = await this.getClass(modulePath);
                this.controller.classes.set(componentName, ComponentClass);
                this.logger.logInfo("Slice", `Class ${componentName} loaded`)
            } catch (error) {
                console.log(error)
                this.logger.logError("Slice", `Error loading class ${modulePath}`, error);
            }
        }


        //Create instance
        try {
            const ComponentClass = this.controller.classes.get(componentName);
            const componentInstance = new ComponentClass(props);

            if(props.id) componentInstance.id = props.id;
            if(props.sliceId) componentInstance.sliceId = props.sliceId;

            this.stylesManager.handleInstanceStyles(componentInstance,props);

            if(!this.controller.registerComponent(componentInstance)) {
                this.logger.logError("Slice", `Error registering instance ${componentName}`);
                return null;
            }

            if(this.debugger.enabled){
                this.debugger.attachDebugMode(componentInstance);
            }

            this.logger.logInfo("Slice", `Instance ${componentInstance.sliceId} created`)
            return componentInstance;

        } catch (error) {
            console.log(error)
            this.logger.logError("Slice", `Error creating instance ${componentName}`, error);
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

    if(window.slice.debugger.enabled){
       await window.slice.debugger.enableDebugMode();
       document.body.appendChild(window.slice.debugger);
    }



}

init();