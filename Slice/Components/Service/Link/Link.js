export default class Link extends HTMLElement {
   constructor(props = {}) {
      super();
      this.props = props;
      this.innerHTML = this.getTemplate(props);
      this.init();
   }

   init() {
      this.addEventListener('click', this.onClick);
   }

   async onClick(event) {
      event.preventDefault();
      const path = this.querySelector('a').getAttribute('href');
      const routeTargets = document.querySelectorAll('slice-routetarget');
      slice.router.navigate(path);
   }

   getTemplate(props = {}) {
      const { path = '#', classes = '', text = '' } = props;
      return `<a href="${path}" class="${classes}" data-route>${text}</a>`;
   }
}

customElements.define('slice-link', Link);
