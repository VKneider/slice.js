export default class Button extends HTMLElement {

   static props = {
      value: { 
         type: 'string', 
         default: 'Button', 
         required: false 
      },
      onClickCallback: { 
         type: 'function', 
         default: null 
      },
      customColor: { 
         type: 'object', 
         default: null 
      },
      icon: { 
         type: 'object', 
         default: null 
      }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$value = this.querySelector('.slice_button_value');
      this.$button = this.querySelector('.slice_button');
      this.$container = this.querySelector('.slice_button_container');
      
      if (props.onClickCallback) {
         this.onClickCallback = props.onClickCallback;
         this.$container.addEventListener('click', async () => await this.onClickCallback());
      }

      slice.controller.setComponentProps(this, props);
   }

   async init() {
      if (this.icon) {
         this.$icon = await slice.build('Icon', {
            name: this.icon,
            size: '20px',
            color: 'currentColor',
         });
         this.$button.insertBefore(this.$icon, this.$value);
      }
   }

   get icon() {
      return this._icon;
   }

   set icon(value) {
      this._icon = value;
      if (!this.$icon) return;
      this.$icon.name = value.name;
      this.$icon.iconStyle = value.iconStyle;
   }

   get value() {
      return this._value;
   }

   set value(value) {
      this._value = value;
      this.$value.textContent = value;
   }

   get customColor() {
      return this._customColor;
   }

   set customColor(value) {
      this._customColor = value;
      if (!value) return;

      // Mantener la misma API: { button: 'color', label: 'color' }
      if (value.button) {
         this.$button.style.backgroundColor = value.button;
         this.$button.style.borderColor = value.button;
      }
      if (value.label) {
         this.$button.style.color = value.label;
         this.$value.style.color = value.label;
         // También aplicar al icono si existe
         if (this.$icon) {
            this.$icon.style.color = value.label;
         }
      }
   }
}

customElements.define('slice-button', Button);