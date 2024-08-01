export default class Route extends HTMLElement {
  constructor(props) {
    super();
    this.props = props;
    this.rendered = false; // Nueva propiedad para rastrear si el componente ha sido renderizado
  }

  init() {
    if (!this.props.href) {
      this.props.href = " ";
    }

    if (!this.props.component) {
      this.props.component = " ";
    }

    this.props.innerHTML = this.innerHTML;
  }

  async render() {
    if (Route.componentCache[this.props.component]) {
      const cachedComponent = Route.componentCache[this.props.component];
      this.innerHTML = '';
      
      if(cachedComponent.update){await cachedComponent.update();} 
      
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
        console.log("Already rendered", this.props.href);
        return true;
      }
      console.log("Rendered", this.props.href);
      await this.render();
      return true;
    }
    if (this.rendered) {
      this.innerHTML = '';
      this.rendered = false;
    }
    return false;
  }
}

Route.componentCache = {};

customElements.define("slice-route", Route);