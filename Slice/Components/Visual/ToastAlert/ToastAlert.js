export default class ToastAlert extends HTMLElement {
  constructor() {
    super();
    slice.controller
      .loadTemplate("./Slice/templates/ToastAlert.html")
      .then((template) => {
        this.shadow = this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        if (this.props != undefined) {
          if (this.props.color != undefined) {
            this.color = this.props.color;
            this.shadowRoot.innerHTML += `<style>
                    .toast::before {background: ${this.color}; } 
                    .toast .column i {color: ${this.color}; }
                    </style>`;
          }
          if (this.props.text != undefined) {
            this.text = this.props.text;
            const textSpan = this.shadowRoot.getElementById("textSpan");
            textSpan.innerHTML = this.text;
          }
          if (this.props.icon != undefined) {
            this.icon = this.props.icon;
            const addIcon = this.shadowRoot.getElementById("addIcon");
            addIcon.classList.add(toastDetails[this.icon].icon);
          }
        }
        const closeBtn = this.shadowRoot.getElementById("closeBtn");
        closeBtn.addEventListener("click", () => {
          this.remove();
        });

        slice.controller.registerComponent(this);
      });
  }

  show() {
    document.body.appendChild(this);
    setTimeout(() => this.remove(), 5000);
  }
}

// Object containing details for different types of toasts
const toastDetails = {
  timer: 5000,
  success: {
    icon: "fa-circle-check",
    text: "Success: This is a success toast.",
  },
  error: {
    icon: "fa-circle-xmark",
    text: "Error: This is an error toast.",
  },
  warning: {
    icon: "fa-triangle-exclamation",
    text: "Warning: This is a warning toast.",
  },
  info: {
    icon: "fa-circle-info",
    text: "Info: This is an information toast.",
  },
};

customElements.define("toast-alert", ToastAlert);
