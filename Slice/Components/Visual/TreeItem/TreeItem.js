export default class TreeItem extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$item = this.querySelector('.slice_tree_item');

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = ['value', 'href', 'onClickCallBack'];

      if (props.onClickCallBack) {
         this.onClickCallback = props.onClickCallBack;
         this.$item.addEventListener('click', async () => {
            await this.onClickCallback();
         });
      }
   }

   async init() {
      if (this._items) {
         for (let i = 0; i < this._items.length; i++) {
            await this.setItem(this._items[i], this.$container);
         }
      }
      // Restaurar el estado del contenedor desde el localStorage
      this.restoreState();
   }

   set value(value) {
      this.$item.textContent = value;
      this._value = value;
   }

   get value() {
      return this._value;
   }

   set href(value) {
      this.$item.href = value;
      this._href = value;
   }

   get href() {
      return this._href;
   }

   set items(values) {
      this._items = values;
      const caret = document.createElement('div');
      caret.classList.add('caret');
      // Crear un contenedor para items
      const container = document.createElement('div');
      container.classList.add('container');
      this.appendChild(container);
      // Añadir
      this.$container = container;

      const toggleContainer = () => {
         const isOpen = caret.classList.toggle('caret_open');
         this.$container.classList.toggle('container_open');
         // Guardar el estado en localStorage
         localStorage.setItem(this.getContainerKey(), isOpen ? 'open' : 'closed');
      };

      caret.addEventListener('click', toggleContainer);

      if (!this.href) {
         this.$item.addEventListener('click', toggleContainer);
      }

      this.$item.appendChild(caret);
   }

   getContainerKey() {
      return `treeitem-${this._value}`;
   }

   restoreState() {
      const state = localStorage.getItem(this.getContainerKey());
      if (state === 'open') {
         const caret = this.$item.querySelector('.caret');
         if (caret) {
            caret.classList.add('caret_open');
         }
         this.$container.classList.add('container_open');
      }
   }

   async setItem(value, addTo) {
      const item = await slice.build('TreeItem', value);
      addTo.appendChild(item);
   }
}

customElements.define('slice-treeitem', TreeItem);
