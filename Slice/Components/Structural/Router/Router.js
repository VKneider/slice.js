import routes from "./routes.js";

export default class Router {
  constructor() {
    this.routes = routes;
    
  }

  async init() {

    await this.loadInitialRoute();
    window.addEventListener('popstate', this.onRouteChange.bind(this));
    const originalAppendChild = document.body.appendChild;

    // Sobrescribir appendChild
    /*
    document.body.appendChild = function (element) {
      const appElement = document.querySelector('#app');
      console.log('Elemento a agregar:', element);
      if (appElement) {
        appElement.appendChild(element);
        console.log('Elemento agregado al #app')
      } else {
        // Si por alguna razón el #app no existe, usar el comportamiento original
        console.log('Elemento agregado al body')
        originalAppendChild.call(document.body, element);
      }
    };
    */
    
   
  }

  async onRouteChange() {
    const path = window.location.pathname;
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
      targetElement.appendChild(existingComponent);
      console.log('Reutilizando componente', existingComponent);
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
