export default class RouteTarget extends HTMLElement {
  constructor(props) {
    super();

    this.props = props;
    this.debuggerProps = [];
  }

  init() {
    //window.addEventListener('popstate', this.render.bind(this));

    if(!this.props.href){
      this.props.href =" "
    }

    if(!this.props.component){
      this.props.component = " "
    }
  }

  async render(){
    window.history.pushState({}, path, window.location.origin + path);
      const component = await slice.build(route.component, {});
      this.innerHTML = '';
      this.appendChild(component);
  }

  
}

customElements.define("slice-routetarget", RouteTarget);
