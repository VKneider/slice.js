export default class InputDocumentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    await this.createInput(this.querySelector(".myInput"), {});
    await this.createInput(
      this.querySelector(".typeText"),
      { type: "text" },
      `{
        type: "text"
      }`
    );
    await this.createInput(
      this.querySelector(".typeNumber"),
      { type: "number" },
      `{
        type: "number"
      }`
    );
    await this.createInput(
      this.querySelector(".typePassword"),
      { type: "password" },
      `{
        type: "password"
      }`
    );
    await this.createInput(
      this.querySelector(".secretProp"),
      { type: "password", secret: true },
      `{
        type: "password", 
        secret: true
      }`
    );
    await this.createInput(
      this.querySelector(".emailType"),
      { type: "email" },
      `{
        type: "email"
      }`
    );
    await this.createInput(
      this.querySelector(".dateType"),
      { type: "date" },
      `{
        type: "date"
      }`
    );
  }

  async createInput(appendTo, inputProps, codeProps) {
    if (!codeProps) {
      codeProps = "{}";
    }
    const myInput = await slice.build("Input", inputProps);

    const componentCode = await slice.build("CodeVisualizer", {
      value: `const myInput = await slice.build("Input", ${codeProps});

`,
      language: "javascript",
    });

    const div = document.createElement("div");
    const inputDiv = document.createElement("div");
    inputDiv.classList.add("inputs");
    inputDiv.appendChild(myInput);
    div.classList.add("inputsContainer");
    div.appendChild(inputDiv);
    div.appendChild(componentCode);

    if (appendTo) {
      appendTo.appendChild(div);
    }
    if (inputProps.onClickCallback) {
      return myInput;
    }

    return div;
  }
}

customElements.define("slice-inputdocumentation", InputDocumentation);
