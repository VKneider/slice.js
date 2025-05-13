export default class RoutingDocumentation extends HTMLElement {
    constructor(props) {
        super();
        slice.attachTemplate(this);

        slice.controller.setComponentProps(this, props);
        this.debuggerProps = [];
    }

    async init() {
        // Code examples for the documentation
        const routesConfigExample = await slice.build("CodeVisualizer", {
            language: "javascript",
            value: `// src/routes.js
const routes = [
   { path: "/", component: "HomePage" },
   { path: "/about", component: "AboutPage" },
   { path: "/contact", component: "ContactPage" },
   { 
      path: "/blog", 
      component: "BlogPage",
      children: [
         { path: "/post/:id", component: "BlogPostPage" },
         { path: "/category/:category", component: "BlogCategoryPage" }
      ] 
   },
   { path: "/dashboard", component: "DashboardPage" },
   { path: "/404", component: "NotFoundPage" }
];

export default routes;`
        });
        this.querySelector(".routes-config-example").appendChild(routesConfigExample);

        const routeComponentExample = await slice.build("CodeVisualizer", {
            language: "javascript",
            value: `
// Creating a Route component programmatically
const userProfileRoute = await slice.build("Route", {
  path: "/profile",
  component: "UserProfile"
});
document.querySelector(".content-container").appendChild(userProfileRoute);
});`
        });

        this.querySelector(".route-component-example").appendChild(routeComponentExample);

        const multiRouteExample = await slice.build("CodeVisualizer", {
            language: "javascript",
            value: `// Creating a MultiRoute component in JavaScript
const dashboardRoutes = await slice.build("MultiRoute", {
   routes: [
      { path: "/dashboard", component: "DashboardHome" },
      { path: "/dashboard/profile", component: "UserProfile" },
      { path: "/dashboard/settings", component: "UserSettings" },
      { path: "/dashboard/activity", component: "UserActivity" }
   ]
});

// Add it to your layout
document.querySelector(".dashboard-content").appendChild(dashboardRoutes);`
        });
        this.querySelector(".multi-route-example").appendChild(multiRouteExample);

        const dynamicRoutesExample = await slice.build("CodeVisualizer", {
            language: "javascript",
            value: `// Route with parameters in routes.js
{ path: "/user/\${id}", component: "UserProfile" }

// Accessing parameters in the component
export default class UserProfile extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      
      // Access the parameter from props
      const userId = props.params.id;
      console.log(\`Loading profile for user \${userId}\`);
      
      // Rest of component implementation...
   }
}`
        });
        this.querySelector(".dynamic-routes-example").appendChild(dynamicRoutesExample);

        const programmaticNavExample = await slice.build("CodeVisualizer", {
            language: "javascript",
            value: `// Navigate programmatically
const navigateButton = await slice.build("Button", {
   value: "Go to Dashboard",
   onClickCallback: async () => {
      // Navigate to a new route
      await slice.router.navigate("/dashboard");
   }
});

// Create a link component
const profileLink = await slice.build("Link", {
   text: "View Profile",
   path: "/dashboard/profile",
   classes: "nav-link"
});`
        });
        this.querySelector(".programmatic-nav-example").appendChild(programmaticNavExample);

        const nestedRoutesExample = await slice.build("CodeVisualizer", {
            language: "javascript",
            value: `// Nested routes configuration
const routes = [
   { 
      path: "/admin",
      component: "AdminLayout", // This will be the parent layout
      children: [
         { path: "/dashboard", component: "AdminDashboard" },
         { path: "/users", component: "UserManagement" },
         { path: "/settings", component: "AdminSettings" }
      ]
   }
];

// In AdminLayout component
export default class AdminLayout extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
   }

   async init() {
      // The layout remains the same, while child routes render in this container
      const contentArea = this.querySelector(".admin-content");
      
      // Create a MultiRoute for the child routes
      const childRoutes = await slice.build("MultiRoute", {
         routes: [
            { path: "/admin/dashboard", component: "AdminDashboard" },
            { path: "/admin/users", component: "UserManagement" },
            { path: "/admin/settings", component: "AdminSettings" }
         ]
      });
      
      contentArea.appendChild(childRoutes);
   }
}`
        });
        this.querySelector(".nested-routes-example").appendChild(nestedRoutesExample);

        // Create navigation visualization examples
        const navVisualization = document.createElement("div");
        navVisualization.classList.add("route-visualization");

        const routeDiv = document.createElement("div");
        routeDiv.classList.add("visualization-route");
        routeDiv.innerHTML = `
         <div class="vis-route-path">/about</div>
         <div class="vis-route-component">AboutPage Component</div>
      `;

        const multiRouteDiv = document.createElement("div");
        multiRouteDiv.classList.add("visualization-multiroute");
        multiRouteDiv.innerHTML = `
         <div class="vis-route-container">
            <div class="vis-route-path">/dashboard</div>
            <div class="vis-route-path">/dashboard/profile</div>
            <div class="vis-route-path">/dashboard/settings</div>
         </div>
         <div class="vis-route-component">Currently Active Component</div>
      `;

        navVisualization.appendChild(routeDiv);
        navVisualization.appendChild(multiRouteDiv);

        this.querySelector(".routing-visualization").appendChild(navVisualization);
    }
}

customElements.define("slice-routingdocumentation", RoutingDocumentation);
