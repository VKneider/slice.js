export default class NotFound extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   init() {
      //change title of the page
      document.title = '404 - Not Found';
   }
}

customElements.define('slice-notfound', NotFound);
