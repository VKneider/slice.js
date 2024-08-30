export default class TreeItem extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      this.$item = this.querySelector('.slice_tree_item');

      this.debuggerProps = ['value', 'path', 'onClickCallback'];
      slice.controller.setComponentProps(this, props);

      if (props.onClickCallback) {
         this.onClickCallback = props.onClickCallback;
         this.$item.addEventListener('click', async () => {
            await this.onClickCallback(this);
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

   set path(value) {
      this.$item.path = value;
      this._path = value;
   }

   get path() {
      return this._path;
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
      
         if (isOpen) {
            // Calcular la altura completa del contenedor
            const fullHeight = this.$container.scrollHeight + 'px';
      
            // Establecer la altura para iniciar la animación
            this.$container.style.height = fullHeight;
      
            // Después de que la animación termine, ajustar la altura a 'auto'
            this.$container.addEventListener('transitionend', function onTransitionEnd() {
               this.style.height = 'auto';
               this.removeEventListener('transitionend', onTransitionEnd);
            });
         } else {
            // Establecer la altura para iniciar la animación de cierre
            this.$container.style.height = this.$container.scrollHeight + 'px';
      
            // Forzar el reflujo para que la transición funcione
            requestAnimationFrame(() => {
               this.$container.style.height = '0';
            });
         }
      
         // Alternar la clase container_open
         this.$container.classList.toggle('container_open');
      
         // Guardar el estado en localStorage
         localStorage.setItem(this.getContainerKey(), isOpen ? 'open' : 'closed');
      };
      
      caret.addEventListener('click', toggleContainer);

      if (!this.path) {
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
         if (this.$container) {
            this.$container.classList.add('container_open');
         }
      }
   }

   async setItem(value, addTo) {
      if (this.onClickCallback) {
         value.onClickCallback = this.onClickCallback;
      }

      const item = await slice.build('TreeItem', value);
      addTo.appendChild(item);
   }
}

customElements.define('slice-treeitem', TreeItem);
