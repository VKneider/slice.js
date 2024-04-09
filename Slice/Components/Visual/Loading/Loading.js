export default class Loading extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    if(!slice.loading){
      slice.loading = this;
    }else {
      console.error("Loading component already exists in the slice object.");
    }
    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["isActive"];
  }

  init() {}

  start() {
    document.body.appendChild(this);
    this._isActive = true;
  }

  stop() {
    this.remove();
    this._isActive = false;
  }

  get isActive() {
    return this._isActive;
  }

  set isActive(value) {
    if (value === true) {
      this._isActive = true;
      if (!this._isActive) this.start();
    }

    if (value === false) {
      this._isActive = false;
      this.stop();
    }
  }
}

customElements.define("slice-loading", Loading);
