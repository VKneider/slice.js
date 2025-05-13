export default class TheSliceTeam extends HTMLElement {
  constructor(props) {
     super();
     slice.attachTemplate(this);

     this.$container = this.querySelector('.slice_team_container');
     this.$title = this.querySelector('.slice_team_title');
     this.$specialThanks = this.querySelector('.slice_special_thanks');

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
           { text: 'Home', path: '/' },
           { text: 'Documentation', path: '/Documentation' },
           { text: 'Playground', path: '/Playground' },
           { text: 'Our Team', path: '/Team' }
        ],
        buttons: [{
           value: 'Change Theme',
           onClickCallback: async () => {
              let theme = slice.stylesManager.themeManager.currentTheme;
              if (theme === 'Slice') await slice.setTheme('Light');
              else if (theme === 'Light') await slice.setTheme('Dark');
              else if (theme === 'Dark') await slice.setTheme('Slice');
           },
        }],
     });

     this.appendChild(navBar);
     
     // Team members data
     const Victor = {
        name: "Victor Kneider",
        role: "Founder. Lead Developer. Software Architect.",
        image: "https://avatars.githubusercontent.com/u/103617388?v=4",
        description: "Computer Engineer and the principal creator of Slice.js. Victor architected the core framework, developed the structural components, implemented the router system, and designed the component lifecycle. He also created the documentation and maintains the repository, laying the groundwork for the entire framework ecosystem.",
        links: [
           {label: "Github", href: "https://github.com/VKneider" },
           {label: "Linkedin", href: "https://www.linkedin.com/in/vkneider/"}
        ]
     };

     const Julio = {
        name: "Julio Graterol",
        role: "Frontend Developer. Visual Components Library Creator and Designer",
        image: "https://avatars.githubusercontent.com/u/99130732?v=4",
        description: "Frontend Developer and Designer. He is the creator of the Visual Components Library and the designer of the Slice.js logo and website.",
        links: [
           {label: "Github", href: "https://github.com/juliograterol"},
           {label: "Linkedin", href: "https://www.linkedin.com/in/julio-graterol-187589289/"}
        ]
     };

     const members = [Victor, Julio];  
     await this.addMembers(members);
     
     // Add special thanks section with animation
     this.renderSpecialThanks();
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

  renderSpecialThanks() {
     const specialThanksContent = document.createElement('div');
     specialThanksContent.className = 'special_thanks_content';
     specialThanksContent.innerHTML = `
        <h3>Special Thanks</h3>
        <p>
          Victor Kneider would like to express his deepest gratitude to <strong>Jubert Pérez</strong> 
          for being a constant source of motivation, support, and encouragement throughout 
          the development of the Slice.js framework. Your belief in this project and guidance 
          have been invaluable to its creation.
        </p>
     `;
     this.$specialThanks.appendChild(specialThanksContent);
  }

  get members() {
     return this._members;
  }

  set members(values) {
     this._members = values;
  }
}

window.customElements.define('slice-team', TheSliceTeam);