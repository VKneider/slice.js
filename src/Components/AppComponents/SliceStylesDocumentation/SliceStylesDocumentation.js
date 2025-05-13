export default class SliceStylesDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      // CSS Variables Section
      const cssVariablesSection = this.querySelector('.css-variables');
      const cssVariablesCode = await slice.build('CodeVisualizer', {
         value: `:root {
  --font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  --border-radius-slice: 5px;
  --slice-border: 1px;
}`,
         language: 'css'
      });
      
      const variablesTable = document.createElement('table');
      variablesTable.className = 'variables-table';
      variablesTable.innerHTML = `
         <tr>
            <th>Variable</th>
            <th>Description</th>
            <th>Default Value</th>
         </tr>
         <tr>
            <td>--font-family</td>
            <td>The primary font family used throughout the application</td>
            <td>system-ui and other system fonts</td>
         </tr>
         <tr>
            <td>--border-radius-slice</td>
            <td>Default border radius for components</td>
            <td>5px</td>
         </tr>
         <tr>
            <td>--slice-border</td>
            <td>Default border width</td>
            <td>1px</td>
         </tr>
      `;
      
      cssVariablesSection.appendChild(cssVariablesCode);
      cssVariablesSection.appendChild(variablesTable);
      
      // Body Styles Section
      const bodyStylesSection = this.querySelector('.body-styles');
      const bodyStylesCode = await slice.build('CodeVisualizer', {
         value: `body {
  margin: 0;
  background-color: var(--primary-background-color);
}`,
         language: 'css'
      });
      
      bodyStylesSection.appendChild(bodyStylesCode);
      
      // Caret Styles Section
      const caretStylesSection = this.querySelector('.caret-styles');
      const caretStylesCode = await slice.build('CodeVisualizer', {
         value: `.caret {
  cursor: pointer;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid;
  transition: transform 0.3s;
}
.caret_open {
  transform: rotate(180deg);
}`,
         language: 'css'
      });
      
      // Create caret demo
      const caretDemo = document.createElement('div');
      caretDemo.className = 'caret-demo';
      
      const normalCaret = document.createElement('div');
      normalCaret.className = 'caret';
      normalCaret.style.borderTopColor = 'var(--primary-color)';
      
      const openCaret = document.createElement('div');
      openCaret.className = 'caret caret_open';
      openCaret.style.borderTopColor = 'var(--primary-color)';
      
      const caretLabel = document.createElement('p');
      caretLabel.textContent = 'Normal caret vs Open caret:';
      
      caretDemo.appendChild(caretLabel);
      caretDemo.appendChild(normalCaret);
      caretDemo.appendChild(openCaret);
      
      caretStylesSection.appendChild(caretStylesCode);
      caretStylesSection.appendChild(caretDemo);
      
      // Scrollbar Styles Section
      const scrollbarStylesSection = this.querySelector('.scrollbar-styles');
      const scrollbarStylesCode = await slice.build('CodeVisualizer', {
         value: `*::-webkit-scrollbar {
  width: 5px;
}
*::-webkit-scrollbar:horizontal {
  height: 3px;
}
*::-webkit-scrollbar-thumb {
  background: var(--secondary-color);
  border-radius: var(--border-radius-slice);
}`,
         language: 'css'
      });
      
      // Create scrollbar demo
      const scrollbarDemo = document.createElement('div');
      scrollbarDemo.className = 'scrollbar-demo';
      
      for (let i = 0; i < 20; i++) {
         const p = document.createElement('p');
         p.textContent = `Scrollbar demo line ${i+1}`;
         scrollbarDemo.appendChild(p);
      }
      
      scrollbarStylesSection.appendChild(scrollbarStylesCode);
      scrollbarStylesSection.appendChild(scrollbarDemo);
   }
}

customElements.define('slice-slicestylesdocumentation', SliceStylesDocumentation);