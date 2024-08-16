export default class Test2 extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async update() {
      const request = await fetch('https://jsonplaceholder.typicode.com/users');
      const response = await request.json();
   }

   async init() {
      const theme = slice.theme;

      const sliceButton = await slice.build('Button', {
         value: 'Change Theme',
         // color:
         onClickCallback: async () => {
            if (slice.theme === 'Slice') {
               await slice.setTheme('Light');
            } else if (slice.theme === 'Light') {
               await slice.setTheme('Dark');
            } else if (slice.theme === 'Dark') {
               await slice.setTheme('Slice');
            }
         },
      });

      const redirectToHomeButton = await slice.build('Button', {
         value: 'Go to Home',
         // color:
         onClickCallback: async () => {
            await slice.router.navigate('/');
         },
      });

      const goTo3Button = await slice.build('Button', {
         value: 'Go to Test3',
         // color:
         onClickCallback: async () => {
            await slice.router.navigate('/3');
         },
      });

      this.appendChild(sliceButton);
      this.appendChild(redirectToHomeButton);
      this.appendChild(goTo3Button);
   }
}

customElements.define('slice-test2', Test2);
