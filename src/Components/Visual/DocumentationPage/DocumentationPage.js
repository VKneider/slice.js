export default class DocumentationPage extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  async init() {

    const components = {
      Button: "Visual",
      Card: "Visual",
      Checkbox: "Visual",
      Input: "Visual",
      Switch: "Visual",
    };

    const div = document.createElement("div");
    // div.style.height = "90vh";
    let theme = slice.stylesManager.themeManager.currentTheme;

    const componentContainer = document.createElement("div");
    componentContainer.classList.add("docs_container");
    componentContainer.id = "componentContainer";
    const divView = document.createElement("div");
    divView.classList.add("docs_container");

    const loading = await slice.build("Loading", {});
    loading.start();

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

    let compVisual = {
      value: "Visual",
      items: [],
    };
    // let compStruc = {
    //   value: "Structural",
    //   items: [],
    // };
    // let compServe = {
    //   value: "Service",
    //   items: [],
    // };

    for (const name in components) {
      const component = {
        value: name,
        href: `Documentation/${name}`,
      };
      if (components[name] === "Visual") {
        compVisual.items.push(component);
      }
      // if (components[name] === "Structural") {
      //   compStruc.items.push(component);
      // }
      // if (components[name] === "Service") {
      //   compServe.items.push(component);
      // }
    }

    div.appendChild(navBar);

    const treeview = await slice.build("TreeView", {
      items: [
        {
          value: "Components",
          items: [compVisual /*compStruc, compServe*/],
        },
      ],
    });

    const mainMenu = await slice.build("MainMenu", {});
    mainMenu.add(treeview);
    div.appendChild(mainMenu);

    let hash = window.location.hash;
    hash = hash.substring(1);
    if (!hash) {
      const documentationPage = await slice.build("Documentation", {});
      divView.appendChild(documentationPage);
    }

    const layOut = await slice.build("Layout", {
      layout: div,
      view: divView,
    });

    document.body.appendChild(layOut);

    if (window.location.hash !== "") {
      await loadComponentFromHash();
    }

    //create an event that every time the hash changes, the component changes
    window.addEventListener("hashchange", async () => {
      await loadComponentFromHash();
    });

    async function loadComponentFromHash() {
      let hash = window.location.hash;
      hash = hash.substring(1);

      let myComponent;

      myComponent = slice.controller.getComponent(`${hash}Documentation`);

      if (!myComponent) {
        myComponent = await slice.build(`${hash}Documentation`, {
          sliceId: `${hash}Documentation`,
        });
      }

      if (!myComponent) {
        return;
      }

      componentContainer.innerHTML = "";
      componentContainer.appendChild(myComponent);
      layOut.showing(componentContainer);
    }
    loading.stop();
  }


}

customElements.define("slice-documentationpage", DocumentationPage);
