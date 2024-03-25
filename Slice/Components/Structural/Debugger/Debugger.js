import sliceConfig from "../../../sliceConfig.json" assert { type: "json" };

export default class Debugger extends HTMLElement {
  constructor() {
    super();
    this.toggleClick = sliceConfig.debugger.click;
    this.toggle = "click";
  }

  async enableDebugMode() {
    const html = await slice.controller.fetchText("Debugger", "html");
    this.innerHTML = html;
    const css = await slice.controller.fetchText("Debugger", "css");
    slice.stylesManager.registerComponentStyles("Debugger", css);

    this.debuggerContainer = this.querySelector("#debugger-container");
    this.closeDebugger = this.querySelector("#close-debugger");
    this.componentDetails = this.querySelector("#component-details");
    this.componentDetailsTable = this.querySelector(".component-details-table");
    this.componentDetailsList = this.querySelector(".component-details-list");

    this.closeDebugger.addEventListener("click", () => this.hideDebugger());

    // Arrastrar y soltar
    this.makeDraggable();

    slice.logger.logInfo("Logger", "Debug mode enabled");
    return true;
  }

  attachDebugMode(component) {
    if (this.toggleClick === "right") {
      this.toggle = "contextmenu";
    } else {
      this.toggle = "click";
    }
    component.addEventListener(this.toggle, (event) =>
      this.handleDebugClick(event, component)
    );
  }

  // VISUAL

  makeDraggable() {
    let offsetX, offsetY;
    let isDragging = false;

    const header = this.querySelector(".debugger-header");

    header.addEventListener("mousedown", (event) => {
      isDragging = true;
      offsetX =
        event.clientX - this.debuggerContainer.getBoundingClientRect().left;
      offsetY =
        event.clientY - this.debuggerContainer.getBoundingClientRect().top;
    });

    document.addEventListener("mousemove", (event) => {
      if (isDragging) {
        const x = event.clientX - offsetX;
        const y = event.clientY - offsetY;

        this.debuggerContainer.style.left = `${x}px`;
        this.debuggerContainer.style.top = `${y}px`;
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }



  handleDebugClick(event, component) {
    event.preventDefault();
    const sliceId = component.sliceId;

    const componentDetails = {
      SliceId: sliceId,
      ClassName: component.constructor.name,
      ComponentProps: {}, // Cambiar el nombre de observedAttributes a ComponentProps
    };

    const realComponentProps = component.debuggerProps;

    realComponentProps.forEach((attr) => {
      // Verificar si el atributo no existe en el componente, asignar el valor de _attr
      if (component[attr] === undefined) {
        componentDetails.ComponentProps[attr] = component[`_${attr}`];
      } else {
        componentDetails.ComponentProps[attr] = component[attr];
      }
    });

    // Mostrar componentProps y sus valores
    this.showComponentDetails(componentDetails);
  }

  showComponentDetails(details) {
    this.componentDetailsList.innerHTML = "";

    // Mostrar información general
    Object.entries(details).forEach(([key, value]) => {
      const listItem = document.createElement("li");
      listItem.textContent = `${key}: ${value}`;
      this.componentDetailsList.appendChild(listItem);
    });

    // Mostrar componentProps y sus valores
    const componentPropsWithValues = this.getAttributesWithValues(
      details.ComponentProps
    );
    const componentPropsWithoutValues = this.getAttributesWithoutValues(
      details.ComponentProps
    );

    if (componentPropsWithValues.length > 0) {
      this.createTable(
        "Component Props with Values",
        componentPropsWithValues,
        details
      );
    }

    if (componentPropsWithoutValues.length > 0) {
      this.createTable(
        "Component Props without Values",
        componentPropsWithoutValues,
        details
      );
    }

    this.debuggerContainer.classList.add("active");
  }



  createTable(title, attributes, details) {
    this.componentDetailsTable.innerHTML = "";
    const tableContainer = document.createElement("div");
    tableContainer.classList.add("table-container");

    const titleElement = document.createElement("h4");
    titleElement.textContent = title;
    tableContainer.appendChild(titleElement);

    const table = document.createElement("table");
    const thead = table.createTHead();
    const tbody = table.createTBody();
    thead.classList.add("slice_thead");
    tbody.classList.add("slice_component-details");

    const headerRow = thead.insertRow();
    const headerCell1 = headerRow.insertCell(0);
    const headerCell2 = headerRow.insertCell(1);

    headerCell1.textContent = "Attribute";
    headerCell2.textContent = "Value";

    attributes.forEach((attr) => {
      const row = tbody.insertRow();
      const cell1 = row.insertCell(0);
      const cell2 = row.insertCell(1);

      cell1.textContent = attr;
      cell2.textContent = details.ComponentProps[attr];
    });

    tableContainer.appendChild(table);
    this.componentDetailsTable.appendChild(tableContainer);
  }

  getAttributesWithValues(attributes) {
    return Object.keys(attributes).filter((attr) => attributes[attr] !== null);
  }

  getAttributesWithoutValues(attributes) {
    return Object.keys(attributes).filter((attr) => attributes[attr] === null);
  }

  hideDebugger() {
    this.debuggerContainer.classList.remove("active");
  }
}

customElements.define("slice-debugger", Debugger);
