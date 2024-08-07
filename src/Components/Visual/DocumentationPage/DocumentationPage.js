export default class DocumentationPage extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];

    this.components = ["Button", "Card", "Checkbox", "Input", "Switch"]
  }

  async init() {

    const loading = await slice.build("Loading", {});
    loading.start();

    const div = document.createElement("div");
    const componentContainer = document.createElement("div");
    componentContainer.classList.add("docs_container");
    componentContainer.id = "componentContainer";

    const divView = document.createElement("div");
    divView.classList.add("docs_container");

    const navBar = await slice.build("Navbar", {
      position: "fixed",
      logo: {
        src: "../../images/Slice.js-logo.png",
        href: "/",
      },
      items: [
        {
          text: "Home",
          href: "/",
        },
        {
          text: "About Us",
          href: "",
          type: "dropdown",
          options: [
            {
              text: "Julio",
              href: "https://github.com/juliograterol",
            },
            {
              text: "Victor",
              href: "https://github.com/VKneider",
            },
          ],
        },
        {
          text: "Documentation",
          href: "/Documentation",
        },
        {
          text: "Playground",
          href: "/Playground",
        },
      ],
      buttons: [
        {
          value: "Change Theme",
          // color:
          onClickCallback: async () => {
            if (theme === "Slice") {
              await slice.setTheme("Light");
              theme = "Light";
            } else if (theme === "Light") {
              await slice.setTheme("Dark");
              theme = "Dark";
            } else if (theme === "Dark") {
              await slice.setTheme("Slice");
              theme = "Slice";
            }
          },
        },
      ],
    });

    const components = {
      Button: "Visual",
      Card: "Visual",
      Checkbox: "Visual",
      Input: "Visual",
      Switch: "Visual",
    };

    let compVisual = {
      value: "Visual",
      items: [],
    };

    for (const name in components) {
      const component = {
        value: name,
        href: `/Documentation/${name}/`,
      };
      if (components[name] === "Visual") {
        compVisual.items.push(component);
      }

    }

    const treeview = await slice.build("TreeView", {
      items: [
        {
          value: "Components",
          items: [compVisual],
        },
      ],
    });

    const mainMenu = await slice.build("MainMenu", {});
    mainMenu.add(treeview);
    div.appendChild(mainMenu);

    div.appendChild(navBar);

    const layOut = await slice.build("Layout", {
      layout: div,
      view: divView,
    });

    let theme = slice.stylesManager.themeManager.currentTheme;

    this.appendChild(layOut);

    if(this.params){
      this.params = this.params.replace("/", ""); 

      if (this.components.includes(this.params)) {
        const component = await slice.build(`${this.params}Documentation`, {
          sliceId: `${this.params}Documentation`,
        });
        componentContainer.innerHTML = "";
        componentContainer.appendChild(component);
        loading.stop();
        return layOut.showing(component);
      }   
    }
    
      const documentationPage = await slice.build("Documentation", {});
      divView.appendChild(documentationPage);
    

    loading.stop();
  }


}

customElements.define("slice-documentation-page", DocumentationPage);
