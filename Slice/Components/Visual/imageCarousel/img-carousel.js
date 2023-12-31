export default class ImgCarousel extends HTMLElement {
  constructor() {
    super();

    this.jumpInterval = 1500;
    this.images = [];
    this.slides = [];
    this.currentImage = 0;
    this.maxImage = 0;

    slice.controller
      .loadTemplate("./Slice/templates/img-carousel.html")
      .then((template) => {
        this.shadow = this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        const nextBtn = this.shadowRoot.getElementById("next");
        const prevBtn = this.shadowRoot.getElementById("prev");
        nextBtn.addEventListener("click", (e) => this.moveNext());
        prevBtn.addEventListener("click", (e) => this.movePrev());
        const slider = this.shadowRoot.getElementById("slider");

        if (this.props != undefined) {
          if (this.props.id != undefined) {
            this.id = this.props.id;
          }
          this.images = this.props.images;
          this.maxImage = this.images.length - 1;
          this.create();
          if (this.props.ratio != undefined) {
            this.changeStyles({ "aspect-ratio": this.props.ratio });
          }
          if (this.props.jumpInterval != undefined) {
            this.jumpInterval = this.props.jumpInterval * 1000;
          }
          if (this.props.height != undefined) {
            this.changeStyles({ height: this.props.height });
          }
          if (this.props.motion != undefined) {
            if (this.props.motion == "fw") {
              this.autoMoveNext();
            } else {
              this.autoMovePrev();
            }
          }
          slice.controller.registerComponent(this);
        }
      });
  }

  connectedCallback() {}

  changeStyles(styles) {
    let slider = this.shadowRoot.getElementById("slider");
    Object.keys(styles).forEach((property) => {
      slider.style[property] = styles[property];
    });
  }

  autoMovePrev() {
    setInterval(
      function () {
        this.movePrev().bind(this);
      }.bind(this),
      this.jumpInterval
    );
  }

  autoMoveNext() {
    setInterval(
      function () {
        this.moveNext().bind(this);
      }.bind(this),
      this.jumpInterval
    );
  }

  moveNext() {
    if (this.currentImage === this.maxImage) {
      this.currentImage = 0;
    } else {
      this.currentImage++;
    }

    this.slides.forEach((slide, idx) => {
      slide.style.transform = `translateX(${100 * (idx - this.currentImage)}%)`;
    });
  }

  movePrev() {
    if (this.currentImage === 0) {
      this.currentImage = this.maxImage;
    } else {
      this.currentImage--;
    }

    this.slides.forEach((slide, idx) => {
      slide.style.transform = `translateX(${100 * (idx - this.currentImage)}%)`;
    });
  }

  create() {
    this.images.forEach((img, idx) => {
      let slider = this.shadow.querySelector(".slider");

      let slide = document.createElement("div");
      slide.classList.add("slide");
      slide.style.transform = `translateX(${idx * 100}%)`;

      let image = document.createElement("img");
      image.src = img;

      slide.appendChild(image);
      slider.appendChild(slide);
      this.slides.push(slide);
    });
  }
}

customElements.define("img-carousel", ImgCarousel);
