export default class ButtonDocumentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    await this.createButton({ value: "Slice Button" });
    await this.createButton({
      value: "Color Button",
      customColor: { color: "black", button: "red" },
    });
    const clickButton = await this.createButton({
      value: "Click",
      onClickCallback: () => {
        clickButton.value = "Clicked";
      },
    });
  }

  async createButton(buttonProps) {
    const myButton = await slice.build("Button", buttonProps);

    const formattedValue = JSON.stringify(buttonProps, null, 2).replace(
      /,(\s*)/g,
      ",\n$1"
    );

    const componentCode = await slice.build("CodeVisualizer", {
      value: `const myButton = await slice.build("Button", 
${formattedValue});`,
      language: "javascript",
    });

    this.appendChild(myButton);
    this.appendChild(componentCode);
  }
}

customElements.define("slice-buttondocumentation", ButtonDocumentation);
