export default class WhatIsSlice extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    this.$tabs = this.querySelectorAll('.tab');
    this.$tabContents = this.querySelectorAll('.tab-content');
    
    // Set up tab switching functionality
    this.$tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // Set up navigation buttons with Slice Router
    this.setupNavigationButtons();

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    // Set the first tab as active by default
    this.switchTab('overview');
    
    // Add animation to code samples for better readability
    this.highlightCode();
    
    // Setup diagram interactions
    this.setupDiagramInteractions();
  }
  
  setupNavigationButtons() {
    // Set up the Installation Guide button
    const installationButton = this.querySelector('.installation-button');
    if (installationButton) {
      installationButton.addEventListener('click', (event) => {
        event.preventDefault();
        slice.router.navigate('/Documentation/Installation');
      });
    }
    
    // Set up the Component Library button
    const componentsButton = this.querySelector('.components-button');
    if (componentsButton) {
      componentsButton.addEventListener('click', (event) => {
        event.preventDefault();
        slice.router.navigate('/Documentation/Components');
      });
    }
  }
  
  switchTab(tabId) {
    // Remove active class from all tabs and tab contents
    this.$tabs.forEach(tab => tab.classList.remove('active'));
    this.$tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to the selected tab and content
    this.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
    this.querySelector(`.tab-content[data-tab="${tabId}"]`).classList.add('active');
  }
  
  highlightCode() {
    // Check if Prism is available (for syntax highlighting)
    if (typeof Prism !== 'undefined') {
      Prism.highlightAllUnder(this);
    }
  }
  
  setupDiagramInteractions() {
    const components = this.querySelectorAll('.component-box');
    
    components.forEach(component => {
      component.addEventListener('mouseenter', () => {
        const type = component.getAttribute('data-type');
        const description = this.querySelector(`.component-description[data-type="${type}"]`);
        if (description) {
          description.classList.add('visible');
        }
      });
      
      component.addEventListener('mouseleave', () => {
        const type = component.getAttribute('data-type');
        const description = this.querySelector(`.component-description[data-type="${type}"]`);
        if (description) {
          description.classList.remove('visible');
        }
      });
    });
  }
}

customElements.define("slice-whatisslice", WhatIsSlice);