
export default class StylesManager {
   constructor() {
      this.componentStyles = document.createElement('style');
      this.componentStyles.id = 'slice-component-styles';
      document.head.appendChild(this.componentStyles);

   }

   async init() {
      for (let i = 0; i < slice.stylesConfig.requestedStyles.length; i++) {
         const styles = await slice.controller.fetchText(slice.stylesConfig.requestedStyles[i], 'styles');
         this.componentStyles.innerText += styles;
         slice.logger.logInfo('StylesManager', `${slice.stylesConfig.requestedStyles[i]} styles loaded`);
      }

      if (slice.themeConfig.enabled) {
         const module = await import(`${slice.paths.components}/Structural/StylesManager/ThemeManager/ThemeManager.js`);
         this.themeManager = new module.default();
         let theme;

         if (slice.themeConfig.saveThemeLocally) {
            theme = localStorage.getItem('sliceTheme');
         }

         if (!theme) {
            theme = slice.themeConfig.defaultTheme;
         }

         if (slice.themeConfig.useBrowserTheme) {
            const browserTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light';
            theme = browserTheme;
         }

         await this.themeManager.applyTheme(theme);
      }
   }

   //add a method that will add css as text to the componentStyles element
   appendComponentStyles(cssText) {
      this.componentStyles.appendChild(document.createTextNode(cssText));
   }

   registerComponentStyles(componentName, cssText) {
      slice.controller.requestedStyles.add(componentName);
      this.appendComponentStyles(cssText);
   }
}
