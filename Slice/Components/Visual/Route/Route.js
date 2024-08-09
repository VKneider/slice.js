export default class Route extends HTMLElement {
   constructor(props) {
      super();
      this.props = props;
      this.rendered = false;
   }

   init() {
      if (!this.props.href) {
         this.props.href = ' ';
      }

      if (!this.props.component) {
         this.props.component = slice.router.pathToRouteMap.get(this.props.href).component || ' ';
      }

      //this.props.innerHTML = this.innerHTML;
   }

   get href() {
      return this.props.href;
   }

   set href(value) {
      this.props.href = value;
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
         const component = await slice.build(this.props.component, {
            sliceId: this.props.component,
         });
         this.innerHTML = '';
         this.appendChild(component);
         Route.componentCache[this.props.component] = component;
      }
      this.rendered = true;
   }

   async updateHTML() {
      if (this.props.href === window.location.pathname) {
         if (this.rendered) {
            await Route.componentCache[this.props.component].update();
            return true;
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
