export default class MainMenu extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$menuButton = this.querySelector('.slice_menu_button');
      this.$closeButton = this.querySelector('.slice_close_menu');
      this.$menu = this.querySelector('.slice_menu');

      this.$menuButton.addEventListener('click', () => {
         this.toggleMenu();
      });
      this.$closeButton.addEventListener('click', () => {
         this.toggleMenu();
      });

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   init() {
      this.addEventListener('mouseleave', () => {
         this.toggleMenu();
      });
   }

   add(value) {
      this.$menu.appendChild(value);
   }

   toggleMenu = () => {
      const isOpen = this.classList.toggle('slice_menu_open');
      this.$isOpen = isOpen;
      return isOpen;
   };
}

customElements.define('slice-mainmenu', MainMenu);
