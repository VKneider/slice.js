export default class Button extends HTMLElement {
  constructor() {
    super();
    slice.controller
      .loadTemplate("./Slice/templates/codeValidator.html")
      .then((template) => {
        this.shadow = this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        const inputs = this.shadowRoot.querySelectorAll("input"),
          button = this.shadowRoot.querySelector("button");

        // iterate over all inputs
        inputs.forEach((input, index1) => {
          input.addEventListener("keyup", (e) => {
            // This code gets the current input element and stores it in the currentInput variable
            // This code gets the next sibling element of the current input element and stores it in the nextInput variable
            // This code gets the previous sibling element of the current input element and stores it in the prevInput variable
            const currentInput = input,
              nextInput = input.nextElementSibling,
              prevInput = input.previousElementSibling;

            // if the value has more than one character then clear it
            if (currentInput.value.length > 1) {
              currentInput.value = "";
              return;
            }
            // if the next input is disabled and the current value is not empty
            //  enable the next input and focus on it
            if (
              nextInput &&
              nextInput.hasAttribute("disabled") &&
              currentInput.value !== ""
            ) {
              nextInput.removeAttribute("disabled");
              nextInput.focus();
            }

            // if the backspace key is pressed
            if (e.key === "Backspace") {
              // iterate over all inputs again
              inputs.forEach((input, index2) => {
                // if the index1 of the current input is less than or equal to the index2 of the input in the outer loop
                // and the previous element exists, set the disabled attribute on the input and focus on the previous element
                if (index1 <= index2 && prevInput) {
                  input.setAttribute("disabled", true);
                  input.value = "";
                  prevInput.focus();
                }
              });
            }
            //if the fourth input( which index number is 3) is not empty and has not disable attribute then
            //add active class if not then remove the active class.
            if (!inputs[5].disabled && inputs[5].value !== "") {
              button.classList.add("active");
              return;
            }
            button.classList.remove("active");
          });
        });

        //focus the first input which index is 0 on window load
        window.addEventListener("load", () => inputs[0].focus());

        slice.controller.registerComponent(this);
      });
  }

  show() {
    document.body.appendChild(this);
  }

  getSubmitButton() {
    return this.shadowRoot.querySelector("button");
  }

  getCode() {
    let code = "";
    const inputs = this.shadowRoot.querySelectorAll("input");
    inputs.forEach((input) => {
      code += input.value;
    });
    return code;
  }
}
window.customElements.define("my-button", Button);
