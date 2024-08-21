import routes from './routes.js';

export default class Router {
   constructor() {
      this.routes = routes;
      this.activeRoute = null;
      this.pathToRouteMap = this.createPathToRouteMap(routes);
   }

   async init() {
      await this.loadInitialRoute();
      window.addEventListener('popstate', this.onRouteChange.bind(this));
   }

   createPathToRouteMap(routes, basePath = '') {
      const pathToRouteMap = new Map();

      for (const route of routes) {
         const fullPath = `${basePath}${route.path}`;
         const routeEntry = { ...route, fullPath };

         pathToRouteMap.set(fullPath, routeEntry);

         if (route.children) {
            const childPathToRouteMap = this.createPathToRouteMap(route.children, fullPath);
            routeEntry.children = childPathToRouteMap;
         }
      }

      return pathToRouteMap;
   }

   async renderRoutesComponentsInPage() {
      const routeContainers = document.querySelectorAll('slice-route, slice-multi-route');
      let routerContainersFlag = false;

      for (const routeContainer of routeContainers) {
         let response = await routeContainer.renderIfCurrentRoute();
         if (response) {
            this.activeRoute = routeContainer.props;
            routerContainersFlag = true;
         }
      }

      return routerContainersFlag;
   }

   async onRouteChange() {
      const path = window.location.pathname;
      const routeContainersFlag = await this.renderRoutesComponentsInPage();

      if (routeContainersFlag) {
         return;
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
      const targetElement = document.querySelector('#app');
      const existingComponent = slice.controller.getComponent(`route-${route.component}`);

      if (slice.loading) {
         slice.loading.start();
      }

      if (existingComponent) {
         targetElement.innerHTML = '';
         if (existingComponent.update) {
            await existingComponent.update();
         }
         targetElement.appendChild(existingComponent);
      } else {
         const component = await slice.build(route.component, {
            params,
            sliceId: `route-${route.component}`,
         });
         targetElement.innerHTML = '';
         targetElement.appendChild(component);
      }

      if (slice.loading) {
         slice.loading.stop();
      }

      slice.router.activeRoute = route;
   }

   async loadInitialRoute() {
      const path = window.location.pathname;
      const { route, params } = this.findIfChildrenRoute();
      await this.handleRoute(route, params);

      await this.renderRoutesComponentsInPage();
   }

   matchRoute(path) {
      const matchedRoute = this.pathToRouteMap.get(path);
      if (matchedRoute) return { route: matchedRoute, params: null };

      for (let route of this.routes) {
         if (route.path.includes('*')) {
            const basePath = route.path.split('*')[0];
            if (path.startsWith(basePath)) {
               const params = path.replace(basePath, '');
               return { route, params };
            }
         }
      }

      const notFoundRoute = this.routes.find((r) => r.path === '/404');
      return { route: notFoundRoute, params: null };
   }

   findIfChildrenRoute() {
      const path = window.location.pathname;
      let route = null;
      let params = null;

      for (const [key, value] of this.pathToRouteMap.entries()) {
         if (path.startsWith(key)) {
            route = value;
            params = path.slice(key.length) || null;
         }
      }

      if (!route) {
         route = this.routes.find((r) => r.path === '/404');
      }

      return { route, params };
   }

   /*
   verifyDynamicRouteExistence(route){
      const routeFromMap = this.pathToRouteMap.get(route.path);

      if(!routeFromMap){
         slice.logger.logError('Router', `Route ${route.path} not found`);
         console.log('Route not found');
      }


   }
      */
}

