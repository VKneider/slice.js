export default class Test1 extends HTMLElement {
  constructor(props) {
    super();
    slice.attachTemplate(this);

    slice.controller.setComponentProps(this, props);
    this.debuggerProps = [];
  }

  
  update(){
    alert("andres es marico")
  }

  async init() {
    const navBar = await slice.build("Navbar", {
      // position: "fixed",
      logo: {
        src: "../../images/Slice.js-logo.png",
        href: "/",
      },
      items: [
        {
          text: "Home",
          href: "/LandingMenu",
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

    this.appendChild(navBar);

    

    const goTo2Button = await slice.build("Button", {
      value: "Go to Test2",
      // color:
      onClickCallback: async () => {
        await slice.router.navigate("/2");
      },
    });

    const goToTestViewButton = await slice.build("Button", {
      value: "Go to TestView",
      // color:
      onClickCallback: async () => {
        await slice.router.navigate("/TestView");
      },
    });
    this.appendChild(goTo2Button)

    const Link = await slice.build("Link", {
      href: "/TestView/Hola",
      text: "Render TestView",
    });

    const LinkTest2 = await slice.build("Link", {
      href: "/2",
      text: "Render Test2",
    });

    const routeTest2 = await slice.build("Route", {
      href: "/2",
      component:"Test2",
    });


    this.appendChild(LinkTest2)
    this.appendChild(routeTest2)
    this.appendChild(Link);

    const RouteTarget = await slice.build("Route", {
      href: "/TestView/Hola",
      component:"TestView",
    });

    this.appendChild(RouteTarget);
  }



}

customElements.define("slice-test1", Test1);
