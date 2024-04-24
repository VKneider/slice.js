export default class ButtonDocumentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    await this.createButton({ value: "Slice Button" });
  }

  async createButton(buttonProps) {
    const myButton = await slice.build("Button", buttonProps);

    const componentCode = await slice.build("CodeVisualizer", {
      value: `const myButton = await slice.build("Button", ${JSON.stringify(buttonProps)})`,

      language: "javascript",
    });

    this.appendChild(myButton);
    this.appendChild(componentCode);
  }
}

customElements.define("slice-buttondocumentation", ButtonDocumentation);
