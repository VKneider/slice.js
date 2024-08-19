export default class MyNavigation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$navigation = this.querySelector('.my_navigation');

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = ['page'];
   }

   set page(value) {
      this._page = value;
      this.updateNavigation();
   }

   get page() {
      return this._page;
   }

   init() {
      if (this.page) {
         this.updateNavigation();
      }
   }

   updateNavigation() {
      this.$navigation.innerHTML = '';
      const idElements = this.page.querySelectorAll('[id]');
  
      idElements.forEach((element) => {
          const a = document.createElement('a');
          a.textContent = element.innerHTML;
  
          // Obtener la jerarquía del elemento, por ejemplo 'h1', 'h2', etc.
          const tagName = element.tagName.toLowerCase();
  
          // Iterar desde h1 hasta h6 para aplicar clases basadas en la jerarquía
          for (let i = 1; i <= 6; i++) {
              if (tagName === `h${i}`) {
                  a.classList.add(`nav-h${i}`);
                  break; // Si ya encontró la coincidencia, no sigue iterando
              }
          }
  
          if (element.id) {
              a.href = `#${element.id}`;
              a.addEventListener('click', (event) => {
                  event.preventDefault();
                  document.getElementById(element.id).scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
          } else {
              a.href = ``;
          }
          this.$navigation.appendChild(a);
      });
  }
  
}

customElements.define('slice-mynavigation', MyNavigation);
