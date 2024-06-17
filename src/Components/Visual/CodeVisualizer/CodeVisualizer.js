export default class CodeVisualizer extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$container = null;
    this.$buttons = null; // Corregir la inicialización de this.$buttons

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["language"];
    this.editor = null;
  }

  connectedCallback() {
    this.createVisualizer();
  }

  async createVisualizer() {
    this.containerId = `code_visualizer_${Math.random()
      .toString(36)
      .substring(7)}`;
    this.$container = this.querySelector(`.${this.containerId}`);
    this.$buttons = this.querySelector(".code_language"); // Inicializar this.$buttons

    if (!this.$container) {
      this.innerHTML = "";
      this.$container = document.createElement("div");
      this.$container.classList.add(this.containerId);
      this.appendChild(this.$container);
    }
    //Cuando se borra esto, la linea 83 hace que todo se vaya a la mierda. Probablemente es un problema de asincronía
    const htmlButton = await slice.build("Button", {
      value: "HTML",
      customColor: {
        color: "White",
        button: "#1E1E1E",
      },
      onClickCallback: () => {
        this.language = "html";
      },
    });

    // Agregar los botones al contenedor de botones (this.$buttons)
    // if (this.$buttons) {
    //   this.$buttons.appendChild(htmlButton);
    //   this.$buttons.appendChild(jsButton);
    //   this.$buttons.appendChild(cssButton);
    // }

    await this.visualize();
  }

  set value(value) {
    this._value = value;
    this.visualize();
  }

  get value() {
    return this._value;
  }

  set language(value) {
    this._language = value;
    this.visualize();
  }

  get language() {
    return this._language;
  }

  async visualize() {
    if (!this.language) {
      this.language = "html";
    }
    const self = this;

    require.config({
      paths: {
        vs: "https://cdn.jsdelivr.net/npm/monaco-editor@latest/min/vs",
      },
    });

    require(["vs/editor/editor.main"], function () {
      self.$container.innerHTML = "";
      if (self.editor) {
        self.editor.dispose();
      }

      self.editor = monaco.editor.create(self.$container, {
        value: self.value,
        language: self.language,
        theme: "vs-dark",
        minimap: { enabled: false },
        lineNumbers: false,
      });
      const contentHeight = self.editor.getContentHeight();
      self.$container.style.height = contentHeight / 2 + "px";
    });
  }
}

customElements.define("slice-codevisualizer", CodeVisualizer);