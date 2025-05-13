export default class ThemesDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // Code examples to show in the documentation
      const themeConfigExample = await slice.build("CodeVisualizer", {
         language: "json",
         value: `{
  "themeManager": {
    "enabled": true,
    "defaultTheme": "Slice",
    "saveThemeLocally": true,
    "useBrowserTheme": false
  }
}`
      });
      this.querySelector(".theme-config-example").appendChild(themeConfigExample);

      const themeApplyExample = await slice.build("CodeVisualizer", {
         language: "javascript",
         value: `// Change to a specific theme
await slice.setTheme("Dark");

// Get current theme
const currentTheme = slice.theme; // Returns theme name, e.g. "Dark"

// In a button or switch to toggle themes
const themeToggleButton = await slice.build("Button", {
   value: "Change Theme",
   onClickCallback: async () => {
      if (slice.theme === "Light") {
         await slice.setTheme("Dark");
      } else {
         await slice.setTheme("Light");
      }
   }
});`
      });
      this.querySelector(".theme-apply-example").appendChild(themeApplyExample);

      const cssVarsExample = await slice.build("CodeVisualizer", {
         language: "css",
         value: `:root {
  /* Main colors */
  --primary-color: #0066ff;
  --primary-color-rgb: rgb(0, 102, 255);
  --primary-background-color: #fff;
  --primary-color-contrast: #fff;
  --primary-color-shade: #ddd;
  
  /* Secondary colors */
  --secondary-color: #63ccfd;
  --secondary-background-color: #ddd;
  --secondary-color-contrast: #fff;
  
  /* State colors */
  --success-color: #00ff40;
  --warning-color: #ffff40;
  --danger-color: #ff0000;
  
  /* Typography */
  --font-primary-color: #000;
  --font-secondary-color: #474747;
  
  /* Other styles */
  --border-radius-slice: 5px;
  --slice-border: 1px;
  --font-family: system-ui, sans-serif;
}`
      });
      this.querySelector(".css-vars-example").appendChild(cssVarsExample);

      const customThemeExample = await slice.build("CodeVisualizer", {
         language: "css",
         value: `/* src/Themes/MyCustomTheme.css */
:root {
  /* Custom corporate theme */
  --primary-color: #8e44ad;            /* Corporate purple */
  --primary-color-rgb: rgb(142, 68, 173);
  --primary-background-color: #f9f9f9; /* Light background */
  --primary-color-contrast: #ffffff;   /* White text on purple */
  --primary-color-shade: #7d3c98;      /* Darker purple for shadows */
  
  --secondary-color: #2ecc71;          /* Secondary green */
  --secondary-background-color: #eee;
  --secondary-color-contrast: #ffffff;
  
  --success-color: #27ae60;
  --warning-color: #f39c12;
  --danger-color: #e74c3c;
  
  --font-primary-color: #333333;
  --font-secondary-color: #666666;
}`
      });
      this.querySelector(".custom-theme-example").appendChild(customThemeExample);

      // Create visual theme examples
      const themeGrid = await slice.build("Grid", {
         columns: 3,
         rows: 1
      });

      // Create color samples for themes
      const createThemeSample = async (themeName, primaryColor, bgColor, textColor) => {
         const sample = document.createElement("div");
         sample.classList.add("theme-sample");
         sample.style.backgroundColor = bgColor;
         sample.style.color = textColor;
         sample.style.borderColor = primaryColor;
         
         const title = document.createElement("h3");
         title.textContent = themeName;
         
         const button = await slice.build("Button", {
            value: "Example Button",
            customColor: {
               button: primaryColor,
               label: textColor
            }
         });
         
         sample.appendChild(title);
         sample.appendChild(button);
         
         return sample;
      };

      const lightSample = await createThemeSample("Light Theme", "#0066ff", "#ffffff", "#000000");
      const darkSample = await createThemeSample("Dark Theme", "#0066ff", "#282828", "#ffffff"); 
      const sliceSample = await createThemeSample("Slice Theme", "#A31D1D", "#FEF9E1", "#6D2323");
      
      await themeGrid.setItem(lightSample);
      await themeGrid.setItem(darkSample);
      await themeGrid.setItem(sliceSample);

      this.querySelector(".theme-samples").appendChild(themeGrid);
   }
}

customElements.define("slice-themesdocumentation", ThemesDocumentation);


