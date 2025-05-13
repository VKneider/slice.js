export default class StructuralDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // Controller documentation section
      const controllerExample = await slice.build("CodeVisualizer", {
         value: `// Accessing components through the Controller
// Get a reference to a component by its sliceId
const navbar = slice.controller.getComponent("main-navbar");

// Check if a component is registered
if (slice.controller.activeComponents.has("user-profile")) {
   // Component exists
}

// Get all active components
const allComponents = slice.controller.activeComponents;

// Register a component manually (rarely needed)
slice.controller.registerComponent(myComponent);

// Build a component with Controller
const myButton = await slice.build("Button", {
   value: "Click Me",
   sliceId: "my-unique-button-id"
});`,
         language: "javascript"
      });
      
      this.querySelector(".controller-example").appendChild(controllerExample);

      // Router documentation section
      const routerExample = await slice.build("CodeVisualizer", {
         value: `// Declaring routes in routes.js
const routes = [
   { path: "/", component: "LandingPage" },
   { path: "/documentation", component: "DocumentationPage" },
   { 
      path: "/user/$id", // Dynamic route parameter
      component: "UserProfile" 
   },
   { path: "/404", component: "NotFound" }
];

export default routes;

// Navigating with Router in your components
// Navigate programmatically
await slice.router.navigate("/documentation");

// Get current route information
const currentRoute = slice.router.activeRoute;

// Create a Route component in your HTML
const routeComponent = await slice.build("Route", {
   path: "/documentation",
   component: "DocumentationPage"
});

// Create a MultiRoute component for multiple routes
const multiRouteComponent = await slice.build("MultiRoute", {
   routes: [
      { path: "/docs/visual", component: "VisualDocumentation" },
      { path: "/docs/service", component: "ServiceDocumentation" }
   ]
});`,
         language: "javascript"
      });
      
      this.querySelector(".router-example").appendChild(routerExample);

      // StylesManager documentation section
      const stylesManagerExample = await slice.build("CodeVisualizer", {
         value: `// Configuring themes in sliceConfig.json
{
   "themeManager": {
      "enabled": true,
      "defaultTheme": "Light",
      "saveThemeLocally": true,
      "useBrowserTheme": false
   }
}

// Theme file structure (e.g., Light.css)
:root {
   --font-primary-color: #000;
   --primary-color: #0066ff;
   --primary-background-color: #fff;
   // ...more theme variables
}

// Switching themes in your components
// Change the current theme
await slice.setTheme("Dark");

// Get the current theme
const currentTheme = slice.theme;

// Access StylesManager directly (rarely needed)
slice.stylesManager.appendComponentStyles(".my-custom-style { color: red; }");`,
         language: "javascript"
      });
      
      this.querySelector(".styles-manager-example").appendChild(stylesManagerExample);

      // Logger documentation section
      const loggerExample = await slice.build("CodeVisualizer", {
         value: `// Configuring logger in sliceConfig.json
{
   "logger": {
      "enabled": true,
      "showLogs": {
         "console": {
            "error": true,
            "warning": true,
            "info": false
         }
      }
   }
}

// Using Logger in your components
// Log an error
slice.logger.logError("MyComponent", "Failed to load data", error);

// Log a warning
slice.logger.logWarning("MyComponent", "Data partially loaded");

// Log information
slice.logger.logInfo("MyComponent", "Component initialized");

// Get all logs
const allLogs = slice.logger.getLogs();

// Get logs by type
const errorLogs = slice.logger.getLogsByLogType("error");

// Get logs for a specific component
const componentLogs = slice.logger.getLogsByComponent("my-component");

// Clear logs
slice.logger.clearLogs();`,
         language: "javascript"
      });
      
      this.querySelector(".logger-example").appendChild(loggerExample);

      // Debugger documentation section
      const debuggerExample = await slice.build("CodeVisualizer", {
         value: `// Configuring debugger in sliceConfig.json
{
   "debugger": {
      "enabled": true,
      "click": "right" // "right" for right-click, "left" for left-click
   }
}

// Defining debug properties in components
export default class MyComponent extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      
      slice.controller.setComponentProps(this, props);
      // Specify which properties can be inspected in the debugger
      this.debuggerProps = ["value", "color", "isActive", "items"];
   }
   
   // ...rest of component code
}`,
         language: "javascript"
      });
      
      this.querySelector(".debugger-example").appendChild(debuggerExample);

      // FAQ section
      const faqQuestions = [
         {
            title: "Can I create my own structural components?",
            text: "No. Structural components are part of the core Slice.js framework and are not meant to be created or modified by users."
         },
         {
            title: "How do I configure structural components?",
            text: "Most structural components are configured through the sliceConfig.json file in your project root. This file allows you to enable/disable features and set various configuration options for each structural component."
         },
         {
            title: "How are structural components initialized?",
            text: "Structural components are automatically initialized during the Slice.js bootstrap process in Slice.js. The initialization sequence is controlled by the Slice.js core and ensures components are loaded in the correct order to resolve dependencies."
         },
         {
            title: "Can I access structural components directly?",
            text: "Yes, most structural components are accessible through the global slice object, such as slice.controller, slice.router, slice.logger, etc. However, direct manipulation should be done carefully and only when necessary."
         },
         {
            title: "How do I extend the Router for advanced functionality?",
            text: "For advanced routing needs, you can implement route guards or middleware by extending the existing Router through service components. Create a custom RouterService that wraps the structural Router and adds your custom logic for route authorization, data prefetching, or analytics tracking."
         }
      ];

      const faqContainer = this.querySelector(".faq-section");
      
      for (const question of faqQuestions) {
         const detailsComponent = await slice.build("Details", {
            title: question.title,
            text: question.text
         });
         
         faqContainer.appendChild(detailsComponent);
      }
   }
}

customElements.define("slice-structuraldocumentation", StructuralDocumentation);