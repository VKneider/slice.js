export default class Link extends HTMLElement {
  static props = {
    path: { type: 'string', default: '#' },
    classes: { type: 'string', default: '' },
    text: { type: 'string', default: '' }
  };

  constructor(props = {}) {
    super();
    slice.attachTemplate(this);
    this.$anchor = this.querySelector('.slice-link');

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = ['path', 'classes', 'text'];
  }

  async init() {
    this.updateLink();
    this.addEventListener('click', this.onClick.bind(this));
  }

  updateLink() {
    if (!this.$anchor) return;
    this.$anchor.setAttribute('href', this.path || '#');
    this.$anchor.textContent = this.text || '';
    this.$anchor.className = `slice-link ${this.classes || ''}`.trim();
  }

  async onClick(event) {
    event.preventDefault();
    const path = this.path || this.$anchor?.getAttribute('href') || '#';
    slice.router.navigate(path);
  }

  set path(value) {
    this._path = value;
    this.updateLink();
  }

  get path() {
    return this._path;
  }

  set classes(value) {
    this._classes = value;
    this.updateLink();
  }

  get classes() {
    return this._classes;
  }

  set text(value) {
    this._text = value;
    this.updateLink();
  }

  get text() {
    return this._text;
  }
}

customElements.define('slice-link', Link);
