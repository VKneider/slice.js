export default class CardDocumentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];
   }

   async init() {
      await this.createCard(this.querySelector('.sliceCard'), {});
      await this.createCard(
         this.querySelector('.myCard'),
         {
            title: 'My Slice Card',
            text: "My Slice Card's information.",
         },
         `{
        title: "My Slice Card",
        text: "My Slice Card's information.",
      }`
      );
      await this.createCard(
         this.querySelector('.cardClick'),
         {
            title: 'Uncover Slice Card',
            text: 'isOpen is true.',
            isOpen: true,
         },
         `{
        title: "Uncover Slice Card",
        text: "isOpen is true",
        isOpen: true
      }`
      );
      await this.createCard(
         this.querySelector('.cardIcon'),
         {
            title: 'Discord',
            text: 'This card has Discord Icon.',
            icon: {
               name: 'discord',
               iconStyle: 'filled',
            },
         },
         `{
        title: "Discord",
        text: "This card has Discord Icon.",
        icon: {
          name: "discord",
          iconStyle: "filled",
        }
      }`
      );
      await this.createCard(
         this.querySelector('.cardColor'),
         {
            title: 'Github',
            text: 'This card has customized colors.',
            icon: {
               name: 'github',
               iconStyle: 'filled',
            },
            customColor: {
               card: 'darkblue',
               icon: 'white',
            },
         },
         `{
        title: "Github",
        text: "This card has customized colors.",
        icon: {
          name: "github",
          iconStyle: "filled",
        },
        customColor: {
          card: "darkblue",
          icon: "white",
        },
      }`
      );
   }

   async createCard(appendTo, cardProps, codeProps) {
      if (!codeProps) {
         codeProps = '{}';
      }
      const myCard = await slice.build('Card', cardProps);

      const componentCode = await slice.build('CodeVisualizer', {
         value: `const myCard = await slice.build("Card", ${codeProps});

`,
         language: 'javascript',
      });

      const div = document.createElement('div');
      const cardDiv = document.createElement('div');
      cardDiv.classList.add('cards');
      cardDiv.appendChild(myCard);
      div.classList.add('cards_container');
      div.appendChild(cardDiv);
      div.appendChild(componentCode);

      if (appendTo) {
         appendTo.appendChild(div);
      }

      return div;
   }
}

customElements.define('slice-carddocumentation', CardDocumentation);
