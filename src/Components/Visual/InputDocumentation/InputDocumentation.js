export default class InputDocumentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    await this.createInput(this.querySelector(".myInput"), {});
    //Props
    await this.createInput(
      this.querySelector(".inputPlaceholder"),
      { placeholder: "Enter text here" },
      `{
        placeholder: "Enter text here"
      }`
    );
    await this.createInput(
      this.querySelector(".requiredProp"),
      {
        placeholder: "Enter text here",
        required: true,
      },
      `{
        placeholder: "Enter text here",
        required: true
      }`
    );
    await this.createInput(
      this.querySelector(".disabledProp"),
      {
        placeholder: "Enter text here",
        disabled: true,
      },
      `{
        placeholder: "Enter text here",
        disabled: true
      }`
    );
    //Types
    await this.createInput(
      this.querySelector(".typeText"),
      {
        placeholder: "Enter text here",
        type: "text",
      },
      `{
        placeholder: "Enter text here",
        type: "text"
      }`
    );
    await this.createInput(
      this.querySelector(".typeNumber"),
      {
        placeholder: "Enter numbers here",
        type: "number",
      },
      `{
        placeholder: "Enter numbers here",
        type: "number"
      }`
    );
    await this.createInput(
      this.querySelector(".typePassword"),
      {
        placeholder: "Password",
        type: "password",
      },
      `{
        placeholder: "Password",
        type: "password"
      }`
    );
    await this.createInput(
      this.querySelector(".secretProp"),
      {
        placeholder: "Password",
        type: "password",
        secret: true,
      },
      `{
        placeholder: "Password",
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
