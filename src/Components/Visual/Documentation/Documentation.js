export default class Documentation extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);

      slice.controller.setComponentProps(this, props);
      this.debuggerProps = [];

   }

   async init() {

      await import("https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js")
      await import("https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js")
      const css = await fetch("https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css")
      const cssText = await css.text()
      const style = document.createElement('style')
      style.innerHTML = cssText
      document.head.appendChild(style)


      const htmlCard = await slice.build('Card', {
         title: 'HTML',
         text: 'HyperText Markup Language is the most basic building block of the Web. It defines the meaning and structure of web content.',
         icon: {
            name: 'html',
            iconStyle: 'filled',
         },
         customColor: {
            card: '#E36A2F',
            icon: 'white',
         },
      });
      const jsCard = await slice.build('Card', {
         title: 'JS',
         text: 'JavaScript is a lightweight interpreted (or just-in-time compiled) programming language with first-class functions.',
         icon: {
            name: 'javascript',
            iconStyle: 'filled',
         },
         customColor: {
            card: 'gold',
            icon: 'white',
         },
      });
      const cssCard = await slice.build('Card', {
         title: 'CSS',
         text: 'Cascading Style Sheets is a stylesheet language used to describe the presentation of a document written in HTML or XML (including XML dialects such as SVG, MathML or XHTML). CSS describes how elements should be rendered on screen, on paper, in speech, or on other media.',
         icon: {
            name: 'css',
            iconStyle: 'filled',
         },
         customColor: {
            card: '#519ABA',
            icon: 'white',
         },
      });
      const grid = await slice.build('Grid', {
         columns: 3,
         rows: 1,
         items: [htmlCard, jsCard, cssCard],
      });

      if (window.screen.width <= 770) {
         grid.columns = 1;
      }

      this.querySelector('.visualComponents').appendChild(grid);

      //Q & A
      const buildQuestion = await slice.build('Details', {
         title: 'How can i build a component?',
         text: "To build a component you need to call the slice.build method with it's required props.",
      });
      const buildExample = await slice.build('CodeVisualizer', {
         value: `const mySliceComponent = await slice.build("MySliceComponentName", props)`,
         language: 'javascript',
      });

      buildQuestion.addDetail(buildExample);

      this.querySelector('.qna').appendChild(buildQuestion);
   }
}

customElements.define('slice-documentation', Documentation);
