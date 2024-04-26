export default class Layout extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
    this.currentView = null;
  }

  async init() {
    if (this.layout) {
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
    if (this.currentView) {
      this.removeChild(this.currentView);
    }
    this.appendChild(view);
    this.currentView = view;
  }

  async onLayOut(view) {
    document.body.appendChild(view);
  }
}

customElements.define("slice-layout", Layout);
