export default class ThemeManager {
  constructor() {
    this.currentThemeLink = null;
  }

  async applyTheme(themeName) {
    // Eliminar el tema actual
    this.removeCurrentTheme();

    // Crear un nuevo link y agregarlo al head
    const themeLink = document.createElement("link");
    themeLink.setAttribute("rel", "stylesheet");
    themeLink.setAttribute("href", `Slice/${slice.paths.themes}/${themeName}.css`);
    document.head.appendChild(themeLink);

    // Establecer el nuevo link como el tema actual
    this.currentThemeLink = themeLink;
  }

  removeCurrentTheme() {
    if (this.currentThemeLink) {
      this.currentThemeLink.parentNode.removeChild(this.currentThemeLink);
    }
  }
}
