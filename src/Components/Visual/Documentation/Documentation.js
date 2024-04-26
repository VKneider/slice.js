export default class Documentation extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {
    const htmlCard = await slice.build("Card", {
      title: "HTML",
      text: "HyperText Markup Language is the most basic building block of the Web. It defines the meaning and structure of web content.",
      icon: {
        name: "html",
        iconStyle: "filled",
      },
      customColor: {
        card: "#E36A2F",
        icon: "white",
      },
    });
    const jsCard = await slice.build("Card", {
      title: "JS",
      text: "JavaScript is a lightweight interpreted (or just-in-time compiled) programming language with first-class functions.",
      icon: {
        name: "javascript",
        iconStyle: "filled",
      },
      customColor: {
        card: "gold",
        icon: "white",
      },
    });
    const cssCard = await slice.build("Card", {
      title: "CSS",
      text: "Cascading Style Sheets is a stylesheet language used to describe the presentation of a document written in HTML or XML (including XML dialects such as SVG, MathML or XHTML). CSS describes how elements should be rendered on screen, on paper, in speech, or on other media.",
      icon: {
        name: "css",
        iconStyle: "filled",
      },
      customColor: {
        card: "#519ABA",
        icon: "white",
      },
    });
    const grid = await slice.build("Grid", {
      columns: 3,
      rows: 1,
      items: [htmlCard, jsCard, cssCard],
    });

    if (window.screen.width <= 770) {
      grid.columns = 1;
    }

    this.querySelector(".visualComponents").appendChild(grid);

    //Q & A
    const build = await this.createQuestion(
      "How can i build a component?",
      "To build a component you need to call the slice.build method with it's required props."
    );
  }

  async createQuestion(question, answer) {
    const qna = await slice.build("Details", { title: question, text: answer });

    this.querySelector(".qna").appendChild(qna);

    return qna;
  }
}

customElements.define("slice-documentation", Documentation);
