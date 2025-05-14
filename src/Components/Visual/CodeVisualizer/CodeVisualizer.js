export default class CodeVisualizer extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$container = this.querySelector('.codevisualizer_container');
      this.$code = this.querySelector('.codevisualizer');
      this.$copyButton = this.querySelector('.copy-button');

      // Configurar el botón de copiado
      this.$copyButton.addEventListener('click', () => this.copyCodeToClipboard());

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = ['language', 'value'];
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
   }

   visualizeCode() {
      if (this._value && this._language) {
         const highlightedCode = this.highlightCode(this._value, this._language);
         this.$code.innerHTML = `<pre><code class="language-${this._language}">${highlightedCode}</code></pre>`;
      }
   }

   copyCodeToClipboard() {
      // Obtenemos el texto sin formato (sin las etiquetas HTML de resaltado)
      const textToCopy = this._value;
      
      // Utilizar el API de clipboard
      navigator.clipboard.writeText(textToCopy)
         .then(() => {
            // Cambiar el texto del botón temporalmente para indicar éxito
            this.$copyButton.textContent = '✓ Copiado!';
            this.$copyButton.classList.add('copied');
            
            // Restaurar el texto original después de 1.5 segundos
            setTimeout(() => {
               this.$copyButton.textContent = 'Copiar';
               this.$copyButton.classList.remove('copied');
            }, 1500);
         })
         .catch(err => {
            console.error('Error al copiar al portapapeles: ', err);
            this.$copyButton.textContent = '❌ Error!';
            
            setTimeout(() => {
               this.$copyButton.textContent = 'Copiar';
            }, 1500);
         });
   }

   highlightCode(code, language) {
      // Escape HTML to prevent XSS
      const escapedCode = this.escapeHtml(code);
      
      switch (language.toLowerCase()) {
         case 'javascript':
         case 'js':
            return this.highlightJavaScript(escapedCode);
         case 'html':
            return this.highlightHtml(escapedCode);
         case 'css':
            return this.highlightCss(escapedCode);
         default:
            return escapedCode;
      }
   }

   escapeHtml(text) {
      return text
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');
   }

   highlightJavaScript(code) {
      // Este método fue rediseñado por completo para evitar problemas de superposición
      let tokenizedCode = code;
      
      // Creamos una estructura para almacenar todos los tokens y luego reemplazarlos de una sola vez
      const tokens = [];
      
      // Función para generar un ID único para cada token
      const generateTokenId = (index) => `__TOKEN_${index}__`;
      
      // Función para extraer tokens y reemplazarlos con marcadores
      const extractTokens = (regex, className) => {
         tokenizedCode = tokenizedCode.replace(regex, (match) => {
            const tokenId = generateTokenId(tokens.length);
            tokens.push({ id: tokenId, content: match, className });
            return tokenId;
         });
      };
      
      // Extraer los tokens en orden específico para evitar interferencias
      
      // 1. Primero los comentarios
      extractTokens(/\/\/.*$/gm, 'code-comment');
      extractTokens(/\/\*[\s\S]*?\*\//g, 'code-comment');
      
      // 2. Luego las cadenas de texto
      extractTokens(/(['"`])(?:\\.|[^\\])*?\1/g, 'code-string');
      
      // 3. Luego los números
      extractTokens(/\b(\d+(?:\.\d+)?)\b/g, 'code-number');
      
      // 4. Palabras clave
      const keywords = [
         'await', 'async', 'break', 'case', 'catch', 'class', 'const', 'continue',
         'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
         'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
         'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
         'typeof', 'var', 'void', 'while', 'with', 'yield', 'let'
      ];
      extractTokens(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), 'code-keyword');
      
      // 5. Objetos y métodos integrados
      const builtins = [
         'Array', 'Boolean', 'Date', 'Error', 'Function', 'JSON', 'Math',
         'Number', 'Object', 'Promise', 'RegExp', 'String', 'console', 'document',
         'window', 'slice', 'Map', 'Set', 'Symbol', 'setTimeout', 'setInterval'
      ];
      extractTokens(new RegExp(`\\b(${builtins.join('|')})\\b`, 'g'), 'code-builtin');
      
      // 6. Métodos y llamadas a funciones (esto debe ir después de extraer las palabras clave)
      extractTokens(/(\.)([a-zA-Z_$][\w$]*)\s*(?=\()/g, 'code-method');
      
      // Reemplazar los tokens con el HTML resaltado
      tokens.forEach(token => {
         tokenizedCode = tokenizedCode.replace(
            token.id, 
            `<span class="${token.className}">${token.content}</span>`
         );
      });
      
      return tokenizedCode;
   }

   highlightHtml(code) {
      // Utilizamos un enfoque similar al de JavaScript para HTML
      let tokenizedCode = code;
      const tokens = [];
      const generateTokenId = (index) => `__TOKEN_${index}__`;
      
      const extractTokens = (regex, className) => {
         tokenizedCode = tokenizedCode.replace(regex, (match) => {
            const tokenId = generateTokenId(tokens.length);
            tokens.push({ id: tokenId, content: match, className });
            return tokenId;
         });
      };
      
      // Extraer tokens HTML en orden
      
      // 1. Comentarios HTML
      extractTokens(/&lt;!--[\s\S]*?--&gt;/g, 'code-comment');
      
      // 2. Etiquetas HTML
      extractTokens(/(&lt;\/?[a-zA-Z0-9-]+)(\s|&gt;)/g, (match, tag, end) => {
         const tokenId = generateTokenId(tokens.length);
         tokens.push({ 
            id: tokenId, 
            content: `<span class="code-tag">${tag}</span>${end}`,
            className: 'no-class' // Ya incluye su propio elemento span
         });
         return tokenId;
      });
      
      // 3. Atributos HTML
      extractTokens(/\s([a-zA-Z0-9-]+)=(&quot;|&#039;)/g, (match, attr, quote) => {
         const tokenId = generateTokenId(tokens.length);
         tokens.push({ 
            id: tokenId, 
            content: ` <span class="code-attribute">${attr}</span>=${quote}`,
            className: 'no-class' // Ya incluye su propio elemento span
         });
         return tokenId;
      });
      
      // Reemplazar los tokens con el HTML resaltado
      tokens.forEach(token => {
         tokenizedCode = tokenizedCode.replace(
            token.id, 
            token.className === 'no-class' ? token.content : `<span class="${token.className}">${token.content}</span>`
         );
      });
      
      return tokenizedCode;
   }

   highlightCss(code) {
      // Utilizamos el mismo enfoque para CSS
      let tokenizedCode = code;
      const tokens = [];
      const generateTokenId = (index) => `__TOKEN_${index}__`;
      
      const extractTokens = (regex, className, processor = null) => {
         tokenizedCode = tokenizedCode.replace(regex, (match, ...groups) => {
            const tokenId = generateTokenId(tokens.length);
            const content = processor ? processor(match, ...groups) : match;
            tokens.push({ id: tokenId, content, className });
            return tokenId;
         });
      };
      
      // Comentarios CSS
      extractTokens(/\/\*[\s\S]*?\*\//g, 'code-comment');
      
      // Selectores CSS
      extractTokens(/([^\{\}]+)(?=\{)/g, 'code-selector');
      
      // Propiedad y valor CSS (manipulando la coincidencia para preservar la estructura)
      tokenizedCode = tokenizedCode.replace(/(\s*)([a-zA-Z-]+)(\s*):(\s*)([^;\{\}]+)(?=;)/g, (match, space1, prop, space2, space3, value) => {
         const propTokenId = generateTokenId(tokens.length);
         tokens.push({ id: propTokenId, content: prop, className: 'code-property' });
         
         const valueTokenId = generateTokenId(tokens.length);
         tokens.push({ id: valueTokenId, content: value, className: 'code-value' });
         
         return `${space1}<span class="code-property">${prop}</span>${space2}:${space3}<span class="code-value">${value}</span>`;
      });
      
      // Colores CSS
      extractTokens(/#([a-fA-F0-9]{3,6})\b/g, 'code-color');
      
      // Reemplazar los tokens restantes
      tokens.forEach(token => {
         if (token.className !== 'no-replace') {
            tokenizedCode = tokenizedCode.replace(
               token.id, 
               `<span class="${token.className}">${token.content}</span>`
            );
         }
      });
      
      return tokenizedCode;
   }
}

customElements.define('slice-codevisualizer', CodeVisualizer);

   