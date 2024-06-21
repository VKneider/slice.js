import routes from "./routes.js";

export default class Router {
  constructor() {
    this.routes = routes;
    this.loadInitialRoute();
    window.addEventListener('popstate', this.onRouteChange.bind(this));
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('a[data-route]').forEach(anchor => {
        anchor.addEventListener('click', function (event) {
          event.preventDefault();
          slice.router.navigate(this.getAttribute('href'));
        });
      });
    });
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
    if (route.component) {
      const component = await slice.build(route.component, { params });
      const targetElement = route.target ? document.querySelector(route.target) : document.querySelector('#app');
      targetElement.innerHTML = '';
      targetElement.appendChild(component);
    } else if (route.callback) {
      route.callback(route.path, params);
    }
  }

  async navigateAndGetComponent(path) {
    window.history.pushState({}, path, window.location.origin + path);
    const { route, params } = this.matchRoute(path);
    if (route && route.component) {
      return await slice.build(route.component, { params });
    } else {
      this.navigate('/404');
      return null;
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
