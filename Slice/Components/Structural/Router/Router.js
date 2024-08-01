import routes from "./routes.js";

export default class Router {
  constructor() {
    this.routes = routes;
    this.activeRoute = null;
  }

  async init() {
    await this.loadInitialRoute();
    this.pathToRouteMap = this.createPathToRouteMap(routes);
    window.addEventListener('popstate', this.onRouteChange.bind(this)); 

  }

  createPathToRouteMap(routes, basePath = "") {
    const pathToRouteMap = new Map();
    for (const route of routes) {
      const fullPath = basePath + route.path;
      pathToRouteMap.set(fullPath, route);

      if (route.children) {
        const childPathToRouteMap = this.createPathToRouteMap(route.children, fullPath);
        for (const [childPath, childRoute] of childPathToRouteMap.entries()) {
          pathToRouteMap.set(childPath, childRoute);
        }
      }
    }
    return pathToRouteMap;
  }


  async onRouteChange() {
    const path = window.location.pathname;
    const routeContainers = document.querySelectorAll('slice-route');
    //Verify if the routeContainers have the same path of the path
    let routerContainersFlag = false;
    for (const routeContainer of routeContainers) {
     let response = await routeContainer.updateHTML() 
        if(response){
          routerContainersFlag = true
        }
    }

    if(routerContainersFlag){
        return
    }

    const { route, params } = this.matchRoute(path);
    if (route) {
      await this.handleRoute(route, params);
    }
  }

  async navigate(path) {
    window.history.pushState({}, path, window.location.origin + path);
    await this.onRouteChange();
  }

  async handleRoute(route, params) {
    const existingComponent = slice.controller.getComponent(`route-${route.component}`);

    if (route.reuse && existingComponent) {
      // Reutilizar el componente
      const targetElement = document.querySelector('#app');
      targetElement.innerHTML = '';

      if(existingComponent.update){await existingComponent.update();} 
      
      targetElement.appendChild(existingComponent);
      slice.router.activeRoute = route;
    } else {
      // Destruir el componente existente si no se debe reutilizar
      if (existingComponent) {
        slice.controller.destroyComponent(existingComponent);
      }
      // Crear y montar el nuevo componente
      const component = await slice.build(route.component, { params, sliceId: `route-${route.component}` });
      const targetElement = document.querySelector('#app');
      targetElement.innerHTML = '';
      targetElement.appendChild(component);
      slice.router.activeRoute = route;
    }
  }

  async loadInitialRoute() {
    const path = window.location.pathname;
    const { route, params } = this.matchRoute(path);
    if (route) {
      await this.handleRoute(route, params);
    }
  }

  matchRoute(path) {
    // 1. Verificar si la ruta exacta está definida en routes
    let matchedRoute = this.routes.find(r => r.path === path);
    if (matchedRoute) {
      return { route: matchedRoute, params: null };
    }

    // 2. Verificar si hay una ruta con comodín que coincida con el inicio del path
    for (let route of this.routes) {
      if (route.path.includes('*')) {
        const basePath = route.path.split('*')[0];
        if (path.startsWith(basePath)) {
          const param = path.replace(basePath, '');
          return { route, params: param };
        }
      }
    }

    // 3. Si no se encuentra ninguna coincidencia, redirigir a la ruta de notFound
    matchedRoute = this.routes.find(r => r.path === '/404');
    return { route: matchedRoute, params: null };
  }

  
}
