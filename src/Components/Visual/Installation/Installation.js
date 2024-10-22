export default class Installation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      this.showCode('npm install slicejs-cli', this.querySelector('.installation'));
      this.showCode('npm run slice:version', this.querySelector('.initialize'));
      this.showCode('npm run slice:create <MyComponent> -- -category v', this.querySelector('.createComp'));
   }

   async showCode(value, appendTo) {
      const code = await slice.build('CodeVisualizer', {
         value: value,
         language: 'javascript',
      });
      appendTo.appendChild(code);
   }
}

customElements.define('slice-installation', Installation);
