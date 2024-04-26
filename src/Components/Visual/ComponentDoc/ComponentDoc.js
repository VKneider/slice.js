export default class ComponentDoc extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    if (this.title) {
      const sectionTitle = document.createElement("h1");
      sectionTitle.textContent = this.title;
      this.appendChild(sectionTitle);
    }
    const section = document.createElement("div");
    if (this.subTitle || this.text) {
      if (this.subTitle) {
        const sectionSubTitle = document.createElement("h2");
        sectionSubTitle.textContent = this.subTitle;
        section.appendChild(sectionSubTitle);
      }
      if (this.text) {
        const sectionText = document.createElement("p");
        sectionText.textContent = this.text;
        sectionText.appendChild(sectionText);
      }
    }
    await this.createComponent(
      section,
      this.component,
      this.componentProps,
      this.code
    );
  }

  async createComponent(appendTo, myComponent, componentProps, code) {
    if (!code) {
      code = "{}";
    }
    const myButton = await slice.build("Button", componentProps);

    const componentCode = await slice.build(`my${myComponent}`, {
      value: `${code}

`,
      language: "javascript",
    });

    const div = document.createElement("div");
    const componentDiv = document.createElement("div");
    componentDiv.classList.add("components");
    componentDiv.appendChild(myButton);
    div.classList.add("componentsContainer");
    div.appendChild(componentDiv);
    div.appendChild(componentCode);

    if (appendTo) {
      appendTo.appendChild(div);
    }
    if (componentProps.onClickCallback) {
      return myButton;
    }

    return div;
  }

  set title(value) {
    this._title = value;
  }
  get title() {
    return this._title;
  }
  set subTitle(value) {
    this._subTitle = value;
  }
  get subTitle() {
    return this._title;
  }
  set text(value) {
    this._text = value;
  }
  get text() {
    return this._text;
  }
  set component(value) {
    this._component = value;
  }
  get component() {
    return this._component;
  }
  set componentProps(value) {
    this._componentProps = value;
  }
  get componentProps() {
    return this._componentProps;
  }
  set code(value) {
    this._code = value;
  }
  get code() {
    return this._code;
  }
}

customElements.define("slice-componentdoc", ComponentDoc);
