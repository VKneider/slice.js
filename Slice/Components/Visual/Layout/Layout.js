export default class Layout extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
    this.currentView = null;
  }

  async init() {
    if(this.layout){
      await this.onLayOut(this.layout);
    }
    if (this.view) {
      await this.showing(this.view);
    }
  }

  get layout() {
    return this._layout;
  }

  set layout(value) {
    this._layout = value;
  }

  get view() {
    return this._view;
  }

  set view(value) {
    this._view = value;
  }

  async showing(view) {

    if(slice.loading){
      slice.loading.start();
    }else {
      const loading = await slice.build("Loading", {});
      loading.start();
    }
    
    if (this.currentView) {
      document.body.removeChild(this.currentView);
    }
    document.body.appendChild(view);
    this.currentView = view;
    slice.loading.stop();
  }

  async onLayOut(view) {
    if(slice.loading){
      slice.loading.start();
    }else {
      const loading = await slice.build("Loading", {});
      loading.start();
    }
    document.body.appendChild(view);
    slice.loading.stop();
  }
}

customElements.define("slice-layout", Layout);
