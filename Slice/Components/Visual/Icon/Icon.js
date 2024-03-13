export default class Icon extends HTMLElement {
    constructor(props) {
        super();
        slice.attachTemplate(this);
        this.$icon = this.querySelector("i");
        slice.controller.setComponentProps(this, props);
        this.debuggerProps = [
            "name",
            "size",
            "color"
        ];
    }

    get name() {
        return this._name;
    }

    set name(value) {
        this._name = value;
        this.$icon.classList.add(`slc-${value}`);
    }

    get size() {
        return this._size;
    }

    set size(value) {

        switch (value) {
            case "small":
                this._size = "16px";
                break;
            case "medium":
                this._size = "20px";
                break;
            case "large":
                this._size = "24px";
                break;
            default:
                this._size = value;
        }

        this.$icon.style.fontSize = value;
    }

    get color() {
        return this._color;
    }

    set color(value) {
        this._color = value;
        this.$icon.style.color = value;
    }


    init() {
        if (!this._name) {
            this.name = "anchor";
        }

        if (!this._size) {
            this.size = "16px";
        }

        if (!this._color) {
            this.color = "black";
        }

    }


}

customElements.define("slice-icon", Icon);
