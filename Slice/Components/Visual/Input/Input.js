
export default class Input extends HTMLElement {
    constructor() {
        super();
        slice.controller.loadTemplate(this).then(component => {

            if (this.props != undefined) {
              if (this.props.id != undefined) {
                  this.id = this.props.id;
              }

                if (this.props.type != undefined) {
                    this.shadowRoot.getElementById("input").type = this.props.type;
                    
                    if(this.props.min!=undefined){
                        this.shadowRoot.getElementById("input").min=this.props.min;
                    }
    
                    if(this.props.max!=undefined){
                        this.shadowRoot.getElementById("input").max=this.props.max;
                    }
                }

               

              if (this.props.placeholder != undefined) {
                  this.shadowRoot.getElementById("input").placeholder = this.props.placeholder;
              }
                
            }

            this.shadowRoot.getElementById("input").addEventListener("input", () => {
                this.value = this.shadowRoot.getElementById("input").value;
            });

        });
    }

    clear() {
        this.shadowRoot.getElementById("input").value = "";
    }

}

customElements.define("my-input", Input);
