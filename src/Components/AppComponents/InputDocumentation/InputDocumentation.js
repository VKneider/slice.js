export default class InputDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      await this.createInput(this.querySelector('.myInput'), {});
      //Props
      await this.createInput(
         this.querySelector('.inputPlaceholder'),
         { placeholder: 'Enter text here' },
         `{
        placeholder: "Enter text here"
      }`
      );
      await this.createInput(
         this.querySelector('.requiredProp'),
         {
            placeholder: 'Enter text here',
            required: true,
         },
         `{
        placeholder: "Enter text here",
        required: true
      }`
      );
      await this.createInput(
         this.querySelector('.disabledProp'),
         {
            placeholder: 'Enter text here',
            disabled: true,
         },
         `{
        placeholder: "Enter text here",
        disabled: true
      }`
      );
      //Types
      await this.createInput(
         this.querySelector('.typeText'),
         {
            placeholder: 'Enter text here',
            type: 'text',
         },
         `{
        placeholder: "Enter text here",
        type: "text"
      }`
      );
      await this.createInput(
         this.querySelector('.typeNumber'),
         {
            placeholder: 'Enter numbers here',
            type: 'number',
         },
         `{
        placeholder: "Enter numbers here",
        type: "number"
      }`
      );
      await this.createInput(
         this.querySelector('.typePassword'),
         {
            placeholder: 'Password',
            type: 'password',
         },
         `{
        placeholder: "Password",
        type: "password"
      }`
      );
      await this.createInput(
         this.querySelector('.secretProp'),
         {
            placeholder: 'Password',
            type: 'password',
            secret: true,
         },
         `{
        placeholder: "Password",
        type: "password", 
        secret: true
      }`
      );
      await this.createInput(
         this.querySelector('.emailType'),
         { placeholder: 'Email', type: 'email' },
         `{
        placeholder: "Email",
        type: "email"
      }`
      );
      await this.createInput(
         this.querySelector('.dateType'),
         { placeholder: 'Date', type: 'date' },
         `{
        placeholder: "Date",
        type: "date"
      }`
      );
      const conditionsInput = await this.createInput(
         this.querySelector('.inputConditions'),
         {
            placeholder: 'Password',
            type: 'password',
            secret: true,
            conditions: {
               // regex: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}$",
               minLength: 8,
               maxLength: 10,
               minMinusc: 1,
               maxMinusc: 4,
               minMayusc: 1,
               maxMayusc: 6,
               minNumber: 1,
               maxNumber: 6,
               minSymbol: 1,
               maxSymbol: 10,
            },
         },
         `{
        placeholder: "Password",
        type: "password",
        secret: true,
        conditions: {
          // regex: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}$",
          minLength: 8,
          maxLength: 10,
          minMinusc: 1,
          maxMinusc: 4,
          minMayusc: 1,
          maxMayusc: 6,
          minNumber: 1,
          maxNumber: 6,
          minSymbol: 1,
          maxSymbol: 10,
        },
      }`,
         'Validate Conditions'
      );
      const regexInput = await this.createInput(
         this.querySelector('.inputRegex'),
         {
            placeholder: 'Password with regex',
            type: 'password',
            secret: true,
            conditions: {
               // regex: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}$",
               minLength: 8,
               maxLength: 10,
               minMinusc: 1,
               maxMinusc: 4,
               minMayusc: 1,
               maxMayusc: 6,
               minNumber: 1,
               maxNumber: 6,
               minSymbol: 1,
               maxSymbol: 10,
            },
         },
         `{
        placeholder: "Password with regex",
        type: "password",
        secret: true,
        conditions: {
          regex: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}$",
          // minLength: 8,
          // maxLength: 10,
          // minMinusc: 1,
          // maxMinusc: 4,
          // minMayusc: 1,
          // maxMayusc: 6,
          // minNumber: 1,
          // maxNumber: 6,
          // minSymbol: 1,
          // maxSymbol: 10,
        },
      }`,
         'Validate Regex'
      );
      await this.inputMethos(
         this.querySelector('.inputMethods'),
         {
            placeholder: 'Methods',
            conditions: {
               minLength: 8,
               minNumber: 1,
               minSymbol: 1,
            },
         },
         `{
        placeholder: "Methods",
        conditions: {
          minLength: 8,
          minNumber: 1,
          minSymbol: 1,
        }
      }`
      );
   }

   async createInput(appendTo, inputProps, codeProps, validate) {
      if (!codeProps) {
         codeProps = '{}';
      }
      const myInput = await slice.build('Input', inputProps);

      const componentCode = await slice.build('CodeVisualizer', {
         value: `const myInput = await slice.build("Input", ${codeProps});

`,
         language: 'javascript',
      });

      const div = document.createElement('div');
      const inputDiv = document.createElement('div');
      inputDiv.classList.add('inputs');
      inputDiv.appendChild(myInput);

      div.classList.add('inputsContainer');
      div.appendChild(inputDiv);
      if (validate) {
         const validateButton = await slice.build('Button', {
            value: validate,
            onClickCallback: () => {
               myInput.validateValue();
            },
         });
         div.appendChild(validateButton);
      }
      div.appendChild(componentCode);

      appendTo.appendChild(div);

      return myInput;
   }

   async inputMethos(appendTo, inputProps, codeProps) {
      if (!codeProps) {
         codeProps = '{}';
      }
      const myInput = await slice.build('Input', inputProps);

      const componentCode = await slice.build('CodeVisualizer', {
         value: `const myInput = await slice.build("Input", ${codeProps});
          
myInput.validateValue();
myInput.clear();
myInput.triggerError();
myInput.triggerSuccess();      

`,
         language: 'javascript',
      });

      const div = document.createElement('div');
      const inputDiv = document.createElement('div');
      inputDiv.classList.add('inputs');
      inputDiv.appendChild(myInput);

      div.classList.add('inputsContainer');
      div.appendChild(inputDiv);
      const buttons = document.createElement('div');
      buttons.classList.add('inputButtons');
      const validateButton = await slice.build('Button', {
         value: 'Validate',
         onClickCallback: () => {
            myInput.validateValue();
         },
      });
      const clearButton = await slice.build('Button', {
         value: 'Clear',
         customColor: {
            button: 'var(--medium-color)',
         },
         onClickCallback: () => {
            myInput.clear();
         },
      });
      const errorButton = await slice.build('Button', {
         value: 'Error',
         customColor: {
            button: 'var(--danger-color)',
         },
         onClickCallback: () => {
            myInput.triggerError();
         },
      });
      const successButton = await slice.build('Button', {
         value: 'Success',
         customColor: {
            button: 'var(--success-color)',
         },
         onClickCallback: () => {
            myInput.triggerSuccess();
         },
      });
      buttons.appendChild(validateButton);
      buttons.appendChild(clearButton);
      buttons.appendChild(errorButton);
      buttons.appendChild(successButton);
      div.appendChild(buttons);
      div.appendChild(componentCode);

      appendTo.appendChild(div);

      return myInput;
   }
}

customElements.define('slice-inputdocumentation', InputDocumentation);
