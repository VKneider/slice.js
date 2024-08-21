export default class Route extends HTMLElement {
   constructor(props) {
      super();
      this.props = props;
      this.rendered = false;
   }

   init() {
      if (!this.props.path) {
         this.props.path = ' ';
      }

      if (!this.props.component) {
         this.props.component = slice.router.pathToRouteMap.get(this.props.path).component || ' ';
      }

      //this.props.innerHTML = this.innerHTML;
   }

   get path() {
      return this.props.path;
   }

   set path(value) {
      this.props.path = value;
   }

   get component() {
      return this.props.component;
   }

   set component(value) {
      this.props.component = value;
   }

   async render() {
      if (Route.componentCache[this.props.component]) {
         const cachedComponent = Route.componentCache[this.props.component];
         this.innerHTML = '';

         if (cachedComponent.update) {
            await cachedComponent.update();
         }

         this.appendChild(cachedComponent);
      } else {
         if (!this.props.component) {
            return;
         }

         if (!slice.controller.componentCategories.has(this.props.component)) {
            slice.logger.logError(`${this.sliceId}`, `Component ${this.props.component} not found`);
            return;
         }

         const component = await slice.build(this.props.component, {
            sliceId: this.props.component,
         });

         this.innerHTML = '';
         this.appendChild(component);
         Route.componentCache[this.props.component] = component;
      }
      this.rendered = true;
   }

   async renderIfCurrentRoute() {
      if (this.props.path === window.location.pathname) {
         if (this.rendered) {
            if (Route.componentCache[this.props.component]) {
               const cachedComponent = Route.componentCache[this.props.component];
               if (cachedComponent.update) {
                  await cachedComponent.update();
               }
               return true;
            }
         }
         await this.render();
         return true;
      }
      return false;
   }

   removeComponent() {
      delete Route.componentCache[this.props.component];
      this.innerHTML = '';
      this.rendered = false;
   }
}

Route.componentCache = {};

customElements.define('slice-route', Route);
