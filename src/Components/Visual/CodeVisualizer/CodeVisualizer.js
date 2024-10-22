export default class CodeVisualizer extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$container = this.querySelector('.codevisualizer_container');
      this.$code = this.querySelector('.codevisualizer');
      this.$copyCode = this.querySelector(".copy_code");

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = ['language', 'value'];
      this.editor = null;
   }

   set value(value) {
      this._value = value;
   }

   get value() {
      return this._value;
   }

   set language(value) {
      this._language = value;
   }

   get language() {
      return this._language;
   }

   init() {
      this.visualizeCode();

      this.$copyCode.addEventListener('click', () => {
         const codeToCopy = this.$code.textContent; 
         const tempTextArea = document.createElement('textarea');
         tempTextArea.value = codeToCopy;
         document.body.appendChild(tempTextArea);

         tempTextArea.select();
         document.execCommand("copy");

         document.body.removeChild(tempTextArea);
         alert("Código copiado al portapapeles.");
      });
   }

   visualizeCode() {
      if (this._value && this._language) {
         this.$code.innerHTML = `<pre><code class="language-${this._language}">${Prism.highlight(
            this._value,
            Prism.languages[this._language],
            this._language
         )}</code></pre>`;
      }
   }
}

customElements.define('slice-codevisualizer', CodeVisualizer);
