export default class Installation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    // Add code for installation steps visualization
    
    // Get all code blocks with copy buttons
    const codeBlocks = this.querySelectorAll('.installation-step-code');
    
    // Add copy functionality to each code block
    codeBlocks.forEach(block => {
      const copyButton = block.querySelector('.copy-button');
      const codeText = block.querySelector('code');
      
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(codeText.textContent.trim());
        copyButton.textContent = 'Copied!';
        
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      });
    });

    // Add animation for terminal output
    const terminals = this.querySelectorAll('.terminal-output');
    terminals.forEach(terminal => {
      const text = terminal.textContent;
      terminal.textContent = '';
      let i = 0;
      
      const typeEffect = () => {
        if (i < text.length) {
          terminal.textContent += text.charAt(i);
          i++;
          setTimeout(typeEffect, 10);
        }
      };
      
      // Start the typing effect when element is in view
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            typeEffect();
            observer.unobserve(entry.target);
          }
        });
      });
      
      observer.observe(terminal);
    });
  }
}

customElements.define('slice-installation', Installation);