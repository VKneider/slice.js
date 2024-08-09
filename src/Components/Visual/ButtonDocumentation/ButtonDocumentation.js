export default class ButtonDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      const grid = await slice.build('Grid', { columns: 2, rows: 1 });
      grid.classList.add('buttonsGrid');

      const simpleButton = await this.createButton(null, {});
      const myButton = await this.createButton(
         null,
         {
            value: 'Slice Button',
         },
         `{
        value: "Slice Button",
      }`
      );

      if (window.screen.width <= 770) {
         grid.columns = 1;
      }

      await grid.setItem(simpleButton);
      await grid.setItem(myButton);

      this.querySelector('.myButton').appendChild(grid);

      await this.createButton(
         this.querySelector('.colorButton'),
         {
            value: 'Color Button',
            customColor: { label: 'black', button: 'red' },
         },
         `{
        value: "Color Button",
        customColor: { label: "black", button: "red" },
      }`
      );
      const clickButton = await this.createButton(
         this.querySelector('.onClick'),
         {
            value: 'Click',
            onClickCallback: () => {
               if (clickButton.value === 'Click') {
                  clickButton.value = 'Clicked';
               } else {
                  clickButton.value = 'Click';
               }
            },
         },
         `{
        value: "Click",
        onClickCallback: () => {
          if (myButton.value === "Click") {
            myButton.value = "Clicked";
          } else {
            myButton.value = "Click";
          }
        },
      }`
      );
   }

   async createButton(appendTo, buttonProps, codeProps) {
      if (!codeProps) {
         codeProps = '{}';
      }
      const myButton = await slice.build('Button', buttonProps);

      const componentCode = await slice.build('CodeVisualizer', {
         value: `const myButton = await slice.build("Button", ${codeProps});

`,
         language: 'javascript',
      });

      const div = document.createElement('div');
      const buttonDiv = document.createElement('div');
      buttonDiv.classList.add('buttons');
      buttonDiv.appendChild(myButton);
      div.classList.add('buttonsContainer');
      div.appendChild(buttonDiv);
      div.appendChild(componentCode);

      if (appendTo) {
         appendTo.appendChild(div);
      }
      if (buttonProps.onClickCallback) {
         return myButton;
      }

      return div;
   }
}

customElements.define('slice-buttondocumentation', ButtonDocumentation);
