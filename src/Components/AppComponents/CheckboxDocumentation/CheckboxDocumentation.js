export default class CheckboxDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      await this.createCheckbox(this.querySelector('.myCheckbox'), {}, `{}`);
      await this.createCheckbox(
         this.querySelector('.colorCheckbox'),
         { customColor: 'gold' },
         `{ 
        customColor: "gold" 
      }`
      );
      await this.createCheckbox(
         this.querySelector('.label'),
         {
            label: 'Checkbox',
         },
         `{
        label: "Checkbox",
      }`
      );
      await this.createCheckbox(
         this.querySelector('.labelLeft'),
         {
            label: 'Left',
            labelPlacement: 'left',
         },
         `{
        label: "Left",
        labelPlacement: "left",
      }`
      );
      await this.createCheckbox(
         this.querySelector('.labelTop'),
         {
            label: 'Top',
            labelPlacement: 'top',
         },
         `{
        label: "Top",
        labelPlacement: "top",
      }`
      );
      await this.createCheckbox(
         this.querySelector('.labelRight'),
         {
            label: 'Right',
            labelPlacement: 'right',
         },
         `{
        label: "Right",
        labelPlacement: "right",
      }`
      );
      await this.createCheckbox(
         this.querySelector('.labelBottom'),
         {
            label: 'Bottom',
            labelPlacement: 'bottom',
         },
         `{
        label: "Bottom",
        labelPlacement: "bottom",
      }`
      );
   }

   async createCheckbox(appendTo, checkboxProps, codeProps) {
      if (!codeProps) {
         codeProps = '{}';
      }
      const myCheckbox = await slice.build('Checkbox', checkboxProps);

      const componentCode = await slice.build('CodeVisualizer', {
         value: `const myCheckbox = await slice.build("Checkbox", ${codeProps});

`,
         language: 'javascript',
      });

      const div = document.createElement('div');
      const checkboxDiv = document.createElement('div');
      checkboxDiv.classList.add('checkboxs');
      checkboxDiv.appendChild(myCheckbox);
      div.classList.add('checkboxs_container');
      div.appendChild(checkboxDiv);
      div.appendChild(componentCode);

      if (appendTo) {
         appendTo.appendChild(div);
      }

      return div;
   }
}

customElements.define('slice-checkboxdocumentation', CheckboxDocumentation);
