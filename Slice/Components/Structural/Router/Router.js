import routes from "./routes.js";

export default class Router {
  constructor() {
    this.routes = routes;
    this.loadInitialRoute();
    window.addEventListener('popstate', this.onRouteChange.bind(this));
  }

  init(){
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
    const route = this.matchRoute(path);
    if (route) {
      await this.handleRoute(route);
    }
  }

  async navigate(path) {
    window.history.pushState({}, path, window.location.origin + path);
    await this.onRouteChange();
  }

  async handleRoute(route) {
    if (route.component) {
      const component = await slice.build(route.component, {});
      const targetElement = route.target ? document.querySelector(route.target) : document.querySelector('#app');
      targetElement.innerHTML = '';
      targetElement.appendChild(component);
    } else if (route.callback) {
      route.callback(route.path);
    }
  }

  async loadInitialRoute() {
    const path = window.location.pathname;
    const route = this.matchRoute(path);
    if (route) {
      await this.handleRoute(route);
    }
  }

  matchRoute(path) {
    const matchedRoute = this.routes.find(r => r.path === path);
    if (!matchedRoute) {
      // Redirect to the notFound route
      return this.routes.find(r => r.path === '/404');
    }
    return matchedRoute;
  }
}

