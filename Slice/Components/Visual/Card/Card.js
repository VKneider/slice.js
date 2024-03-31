 class Card2 extends HTMLElement {
  constructor(props) {
    super();
    slice.controller.loadTemplate(this);
    if (props != undefined) {
      if (props.color != undefined) {
        this.shadowRoot
          .getElementById("Card")
          .style.setProperty("--card-color", props.color);
      }

      let iconContainer = this.shadowRoot.getElementById("icon-con");
      iconContainer.innerHTML += `<i  ${props.css} class="${props.icon}"></i>`;
      let text = this.shadowRoot.getElementById("text");
      text.innerHTML = props["text"];
      let title = this.shadowRoot.querySelector(".title");
      title.innerHTML = props["title"];
    }

    slice.controller.registerComponent(this);
  }
}

customElements.define("card-box", Card);

export default class Card extends HTMLElement {
  constructor(props) {
    super();
    this.$title = this.querySelector(".title")
    this.$text = this.querySelector(".text")
    this.$iconContainer = this.querySelector(".icon-container")
  }

  async init(){
    this.$icon = await slice.build("Icon", {
      name:"twitter",
      size:"100px",
      color:"lightblue",
      iconStyle:"filled"
    })
  }
}

customElements.define("card-box", Card);

