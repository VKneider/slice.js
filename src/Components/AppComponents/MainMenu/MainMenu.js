export default class MainMenu extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$menuButton = this.querySelector('.slice_menu_button');
      this.$closeButton = this.querySelector('.slice_close_menu');
      this.$menu = this.querySelector('.slice_menu');

      this.$menuButton.addEventListener('click', () => {
         this.handleOpenMenu();
      });
      this.$closeButton.addEventListener('click', () => {
         this.handleCloseMenu();
      });

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   init() {
      this.addEventListener('mouseleave', () => {
         if (this.querySelector('.slice_menu_open')) {
            this.handleCloseMenu();
         }
      });
   }

   add(value) {
      this.$menu.appendChild(value);
   }

   handleOpenMenu() {
      this.classList.add('slice_menu_open');
   }

   handleCloseMenu() {
      this.classList.remove('slice_menu_open');
   }
}

customElements.define('slice-mainmenu', MainMenu);
