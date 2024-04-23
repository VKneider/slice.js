export default class CodeVisualizer extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);
    this.$container = this.querySelector(".code_visualizer");
    this.$buttons = this.querySelector(".code_language");

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ["language"];
    this.editor = null; // Mantén una referencia al editor de Monaco
  }

  async init() {
    await this.visualize();
    const htmlButton = await slice.build("Button", {
      value: "HTML",
      customColor: {
        color: "White",
        button: "#1E1E1E",
      },
    });
    const cssButton = await slice.build("Button", {
      value: "CSS",
      customColor: {
        color: "White",
        button: "#1E1E1E",
      },
    });
    this.$buttons.appendChild(htmlButton);
    this.$buttons.appendChild(cssButton);
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
      paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@latest/min/vs" },
    });

    require(["vs/editor/editor.main"], function () {
      if (self.editor) {
        self.editor.dispose();
      }

      self.editor = monaco.editor.create(self.$container, {
        value: self.value.innerHTML,
        language: self.language,
        theme: "vs-dark",
        minimap: { enabled: false },
      });
      var monacoEditor = self.$container.querySelector(".monaco-editor");
      var monacoGuard = monacoEditor.querySelector(".overflow-guard");
      monacoEditor.style.borderRadius = "10px";
      monacoGuard.style.borderRadius = "10px";
      monacoEditor.style.paddingTop = "10px";
    });

    self.$container.style.height = "30vh";
  }
}

customElements.define("slice-codevisualizer", CodeVisualizer);
