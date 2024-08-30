export default class Details extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$detailsTitle = this.querySelector('.details_title');
      this.$detailsText = this.querySelector('.details_text');
      this.$details = this.querySelector('.full_details');
      this.$summary = this.querySelector('.details_summary');
      this.$container = this.querySelector('.details_container'); // Referencia al contenedor

      this.$summary.addEventListener('click', () => {
         this.toggleDetails();
      });

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = ['title', 'text'];
   }

   toggleDetails() {
      const isOpen = this.$container.classList.toggle('details_open');
      const symbol = this.$summary.querySelector('.symbol');

      if (isOpen) {
         symbol.classList.remove('plus');
         symbol.classList.add('minus');

         // Obtener la altura total del contenedor
         const fullHeight = this.$container.scrollHeight + 'px';

         // Establecer la altura para iniciar la animación
         this.$container.style.height = fullHeight;

         // Después de la transición, ajustar la altura a 'auto'
         this.$container.addEventListener('transitionend', function onTransitionEnd() {
            this.style.height = 'auto';
            this.removeEventListener('transitionend', onTransitionEnd);
         });
      } else {
         symbol.classList.remove('minus');
         symbol.classList.add('plus');

         // Establecer la altura para iniciar la animación de cierre
         this.$container.style.height = this.$container.scrollHeight + 'px';

         // Forzar el reflujo para que la transición funcione
         requestAnimationFrame(() => {
            this.$container.style.height = '0';
         });
      }
   }

   get title() {
      return this._title;
   }

   set title(value) {
      this._title = value;
      this.$detailsTitle.textContent = value;
   }

   get text() {
      return this._text;
   }

   set text(value) {
      this._text = value;
      this.$detailsText.textContent = value;
   }

   addDetail(value) {
      this.$details.appendChild(value);
   }
}

customElements.define('slice-details', Details);
