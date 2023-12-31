export default class CustomStylesComponent {
  constructor() {
    this.styles = document.createElement('style');
    document.head.appendChild(this.styles);
    this.cachedStyles = new Set();
  }

  async proccess(instance,props){
    
    const { customCSS } = props;
    if(customCSS.url){
      await this.loadStyles(customCSS.url);
    }
    if(customCSS.classNames){
      
      this.removeClasses(instance);
      await this.applyStyles(instance, customCSS.classNames);
    }

  }

  async loadStyles(url) {
    if (!this.cachedStyles.has(url)) {
      try {
        const response = await fetch(url);
        const cssText = await response.text();

        // Almacenar en caché el estilo
        this.cachedStyles.add(url);

        // Agregar los estilos del archivo CSS personalizado a la propiedad "styles"
        this.styles.appendChild(document.createTextNode(cssText));
      } catch (error) {
        console.error(`Error al cargar el estilo personalizado: ${url}`, error);
      }
    }
  }

  async applyStyles(instance, classNames) {    
    classNames.forEach(className => {
      instance.classList.add(className);
    });
  }
    
    removeClasses(instance){
      while (instance.classList.length > 0) {
        instance.classList.remove(instance.classList.item(0));
      }
    }

  
}
