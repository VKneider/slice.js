export default class Layout extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
    this.currentView = null;
  }

  async init() {
    const loading = await slice.build("Loading", {});
    loading.start();
    await this.onLayOut(this.layout);
    if (this.view) {
      await this.onView(this.view);
    }
    loading.stop();
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

  async onView(view) {
    if (this.currentView) {
      document.body.removeChild(this.currentView);
    }
    document.body.appendChild(view);
    this.currentView = view;
  }

  async onLayOut(view) {
    document.body.appendChild(view);
  }
}

customElements.define("slice-layout", Layout);
