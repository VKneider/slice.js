export default class MultiRoute extends HTMLElement {
   constructor(props) {
      super();
      this.props = props;
      this.renderedComponents = new Map(); // Cache para componentes renderizados
   }

   init() {
      if (!this.props.routes || !Array.isArray(this.props.routes)) {
         slice.logger.logError('MultiRoute', 'No valid routes array provided in props.');
         return;
      }

      /*
      this.props.routes.forEach(route => {
         if (!route.path || !route.component) {
            slice.logger.logError('MultiRoute', 'Route must have a path and a component.');
         }

         console.log(route)

         slice.router.verifyDynamicRouteExistence(route)
      });

      // verify if the current route is registered in the routes.js file
      slice.router.verifyDynamicRouteExistence(this.props.routes)
      */
   }

   // Find the route whose path matches the current URL, case-insensitively.
   // '/About' matches a route declared as '/about'. (Dynamic params like ${id}
   // are still resolved by the top-level router, not by MultiRoute.)
   matchRoute() {
      const currentPath = window.location.pathname.toLowerCase();
      return this.props.routes.find(
         (route) => typeof route.path === 'string' && route.path.toLowerCase() === currentPath
      );
   }

   async render() {
      const routeMatch = this.matchRoute();

      if (routeMatch) {
         const { component } = routeMatch;

         if (this.renderedComponents.has(component)) {
            const cachedComponent = this.renderedComponents.get(component);

            // Aquí nos aseguramos de que el contenido se limpie antes de insertar el componente en caché.
            this.innerHTML = '';

            // Si el componente en caché tiene un método update, lo ejecutamos
            if (cachedComponent.update) {
               await cachedComponent.update();
            }

            // Insertamos el componente en caché en el DOM
            this.appendChild(cachedComponent);
         } else {
            if (!slice.controller.componentCategories.has(component)) {
               slice.logger.logError(`${this.sliceId}`, `Component ${component} not found`);
               return;
            }

            // Si el componente no está en caché, lo construimos y lo almacenamos en la caché
            const newComponent = await slice.build(component, { sliceId: component });
            this.innerHTML = '';
            this.appendChild(newComponent);

            // Guardamos el componente recién construido en la caché
            this.renderedComponents.set(component, newComponent);
         }
      } else {
         // Limpiamos el contenido si no hay una coincidencia de ruta
         this.innerHTML = '';
      }
   }

   async renderIfCurrentRoute() {
      const routeMatch = this.matchRoute();

      if (routeMatch) {
         await this.render(); // Llamamos a render() para manejar el renderizado desde la caché si es necesario
         return true;
      }
      return false;
   }

   removeComponent() {
      const routeMatch = this.matchRoute();

      if (routeMatch) {
         const { component } = routeMatch;
         this.renderedComponents.delete(component);
         this.innerHTML = '';
      }
   }
}

customElements.define('slice-multi-route', MultiRoute);
