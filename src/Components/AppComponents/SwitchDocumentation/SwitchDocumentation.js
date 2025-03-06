export default class SwitchDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      await this.createSwitch(this.querySelector('.mySwitch'), {}, `{}`);
      await this.createSwitch(
         this.querySelector('.colorSwitch'),
         { customColor: 'gold' },
         `{ 
        customColor: "gold" 
      }`
      );
      await this.createSwitch(
         this.querySelector('.label'),
         {
            label: 'Switch',
         },
         `{
        label: "Switch",
      }`
      );
      await this.createSwitch(
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
      await this.createSwitch(
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
      await this.createSwitch(
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
      await this.createSwitch(
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

   async createSwitch(appendTo, switchProps, codeProps) {
      if (!codeProps) {
         codeProps = '{}';
      }
      const mySwitch = await slice.build('Switch', switchProps);

      const componentCode = await slice.build('CodeVisualizer', {
         value: `const mySwitch = await slice.build("Switch", ${codeProps});

`,
         language: 'javascript',
      });

      const div = document.createElement('div');
      const switchDiv = document.createElement('div');
      switchDiv.classList.add('switchs');
      switchDiv.appendChild(mySwitch);
      div.classList.add('switchs_container');
      div.appendChild(switchDiv);
      div.appendChild(componentCode);

      if (appendTo) {
         appendTo.appendChild(div);
      }

      return div;
   }
}

customElements.define('slice-switchdocumentation', SwitchDocumentation);
