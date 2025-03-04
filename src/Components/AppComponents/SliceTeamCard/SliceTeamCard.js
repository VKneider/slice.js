export default class SliceTeamCard extends HTMLElement {
  constructor(props) {
     super();
     slice.attachTemplate(this);

     this.$imageContainer = this.querySelector('.team_card_image img'); 
     this.$name = this.querySelector('.team_card_name');
     this.$role = this.querySelector('.team_card_role');
     this.$description = this.querySelector('.team_card_description');
     this.$links = this.querySelector('.team_card_links');

     slice.controller.setComponentProps(this, props);
     this.debuggerProps = ['name', 'role', 'image', 'description', 'links'];
  }

  get name() {
     return this._name;
  }

  set name(value) {
     this._name = value;
     if (this.$name) this.$name.textContent = value;
  }

  get role() {
     return this._role;
  }

  set role(value) {
     this._role = value;
     if (this.$role) this.$role.textContent = value;
  }

  get image() {
     return this._image;
  }

  set image(value) {
     this._image = value;
     if (this.$imageContainer) {
        this.$imageContainer.src = value;
        this.$imageContainer.alt = value ? `${this._name} profile picture` : 'Profile image';
     }
  }

  get description() {
     return this._description;
  }

  set description(value) {
     this._description = value;
     if (this.$description) this.$description.textContent = value;
  }

  get links() {
     return this._links;
  }

  set links(values) {
     this._links = values;
     if (this.$links) {
        this.$links.innerHTML = ''; // Limpiar enlaces previos
        values.forEach(link => {
           const a = document.createElement('a');
           a.href = link.href;
           a.textContent = link.label;
           a.target = '_blank';
           this.$links.appendChild(a);
        });
     }
  }
}

window.customElements.define('slice-team-card', SliceTeamCard);
