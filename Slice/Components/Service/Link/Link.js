export default class Link extends HTMLElement {
  constructor(props = {}) {
    super();
    this.props = props;
    this.innerHTML = this.getTemplate(props);
    this.init();
  }

  init() {
    this.addEventListener('click', this.onClick.bind(this));
  }

  async onClick(event) {
    event.preventDefault();
    const href = this.querySelector('a').getAttribute('href');
    const routeTargets = document.querySelectorAll('slice-routetarget');
    let handled = false;

    for (const target of routeTargets) {
      if (href.startsWith(target.getAttribute('href'))) {
        await target.render(href);
        handled = true;
        break;
      }
    }

    if (!handled) {
      slice.router.navigate(href);
    }
  }

  getTemplate(props = {}) {
    const { href = '#', classes = '', text = '' } = props;
    return `<a href="${href}" class="${classes}" data-route>${text}</a>`;
  }
}

customElements.define('slice-link', Link);
