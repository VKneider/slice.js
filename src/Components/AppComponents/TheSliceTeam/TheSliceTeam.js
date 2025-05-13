export default class TheSliceTeam extends HTMLElement {
  constructor(props) {
     super();
     slice.attachTemplate(this);

     this.$container = this.querySelector('.slice_team_container');
     this.$title = this.querySelector('.slice_team_title');

     slice.controller.setComponentProps(this, props);
     this.debuggerProps = ['members'];
  }

  async init() {



   const navBar = await slice.build('Navbar', {
      position: 'fixed',
      logo: {
         src: '/images/Slice.js-logo.png',
         path: '/',
      },
      items: [
         {
            text: 'Home',
            path: '/',
         },
         {
            text: 'Documentation',
            path: '/Documentation',
         },
         {
            text: 'Playground',
            path: '/Playground',
         },
         {
            text: 'Our Team',
            path: '/Team',
         }

      ],
      buttons: [
         {
            value: 'Change Theme',
            // color:
            onClickCallback: async () => {

               let theme = slice.stylesManager.themeManager.currentTheme;
               if (theme === 'Slice') {
                  await slice.setTheme('Light');
                  //theme = 'Light';
               } else if (theme === 'Light') {
                  await slice.setTheme('Dark');
                  //theme = 'Dark';
               } else if (theme === 'Dark') {
                  await slice.setTheme('Slice');
                  //theme = 'Slice';
               }
            },
         },
      ],
   });


   this.appendChild(navBar);
   
    const Victor = {
      name: "Victor Kneider",
      role: "Founder. Lead Developer. Software Architect.",
      image:"https://avatars.githubusercontent.com/u/103617388?v=4",
      description: "Computer Engineer passionate and ethusiast about technology and Component-Based Development. He is the creator of Slice.js and the main developer of the project.",
      links: [
         {label: "Github", href: "https://github.com/VKneider" },
         {label: "Linkedin", href:"https://www.linkedin.com/in/vkneider/"}
      ]
   
       

      
    }


    const Julio = {
      name: "Julio Graterol",
      role: "Frontend Developer. Visual Components Library Creator and Designer",
      image:"https://avatars.githubusercontent.com/u/99130732?v=4",
      //julio is a frontend developer and designer, he is the creator of the visual components library and the designer of the Slice.js logo and website.
      description: "Frontend Developer and Designer. He is the creator of the Visual Components Library and the designer of the Slice.js logo and website.",
      links: [
         {label: "Github", href: "https://github.com/juliograterol"},
         {label: "Linkedin", href:"https://www.linkedin.com/in/julio-graterol-187589289/"}
      ]

     
    }

    const members = [Victor, Julio];  

    await this.addMembers(members);
     
  }

  async addMembers(members) {
     for (let i = 0; i < members.length; i++) {
        await this.addMember(members[i]);
     }
  }

  async addMember(member) {
     const card = await slice.build('SliceTeamCard', {
        name: member.name,
        role: member.role,
        image: member.image,
        description: member.description,
        links: member.links
     });
     this.$container.appendChild(card);
  }

  get members() {
     return this._members;
  }

  set members(values) {
     this._members = values;
  }
}

window.customElements.define('slice-team', TheSliceTeam);
