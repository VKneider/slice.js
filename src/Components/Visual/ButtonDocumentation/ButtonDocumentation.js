export default class ButtonDocumentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    const grid = await slice.build("Grid", { columns: 2, rows: 1 });
    grid.classList.add("buttons");

    const simpleButton = await this.createButton(null, {});
    const myButton = await this.createButton(null, {
      value: "Slice Button",
    });

    await grid.setItem(simpleButton);
    await grid.setItem(myButton);

    this.querySelector(".myButton").appendChild(grid);

    await this.createButton(this.querySelector(".colorButton"), {
      value: "Color Button",
      customColor: { color: "black", button: "red" },
    });
    const clickButton = await this.createButton(
      this.querySelector(".onClick"),
      {
        value: "Click",
        onClickCallback:
          '() => { if (clickButton.value === "Click") { clickButton.value = "Clicked"; } else { clickButton.value = "Click"; }}',
        click: () => {
          if (clickButton.value === "Click") {
            clickButton.value = "Clicked";
          } else {
            clickButton.value = "Click";
          }
        },
      }
    );
  }

  async createButton(appendTo, buttonProps) {
    const formattedValue = JSON.stringify(buttonProps, null, 2).replace(
      /,(\s*)/g,
      ",\n$1"
    );

    buttonProps.onClickCallback = buttonProps.click;
    const myButton = await slice.build("Button", buttonProps);

    const componentCode = await slice.build("CodeVisualizer", {
      value: `const myButton = await slice.build("Button", 
${formattedValue});`,
      language: "javascript",
    });

    const div = document.createElement("div");
    div.appendChild(myButton);
    div.appendChild(componentCode);

    if (appendTo) {
      appendTo.appendChild(div);
    }

    return div;
  }
}

customElements.define("slice-buttondocumentation", ButtonDocumentation);
