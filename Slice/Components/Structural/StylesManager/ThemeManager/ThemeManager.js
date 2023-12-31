export default class ThemeManager {
    constructor() {
      this.registeredThemes = new Map();
      this.currentThemeLink = null;
    }
  
    // Registrar un tema con su nombre
    registerTheme(themeName, isDefault = false) {
      this.registeredThemes.set(themeName, isDefault);
    }
  
    applyTheme(themeName) {
        if (!this.isThemeRegistered(themeName)) {
            this.removeCurrentTheme();
            const themeCSSURL = `${slice.paths.themes}/${themeName}.css`; // Usar slice.paths.themes
            this.loadThemeCSS(themeCSSURL);        
        }
      }
    
  
    removeCurrentTheme() {
      if (this.currentThemeLink) {
        this.currentThemeLink.parentNode.removeChild(this.currentThemeLink);
      }
    }
  
    loadThemeCSS(themeCSSURL) {
      const themeLink = document.createElement('link');
      themeLink.rel = 'stylesheet';
      themeLink.href = themeCSSURL;
      themeLink.setAttribute('data-theme', 'true');
      document.head.appendChild(themeLink);
      this.currentThemeLink = themeLink;
    }
  
    isThemeRegistered(themeName) {
      return this.registeredThemes.has(themeName);
    }
  
   
  }

  /*

    la filosofia va a ser que el usuario utilice el tema slice por default o setee un tema personalizado, luego que simplemente 
    utilice componentes que ya tendrán el tema puesto.

    el tema slice por default va a ser el tema que se carga por default en el constructor de ThemeManager, y va a ser el tema que se carga

  */