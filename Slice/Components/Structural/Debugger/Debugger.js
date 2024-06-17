import sliceConfig from "../../../sliceConfig.json" with { type: "json" };

export default class Debugger extends HTMLElement {
  constructor() {
    super();
    this.toggleClick = sliceConfig.debugger.click;
    this.toggle = "click";
    this.selectedComponentSliceId = null;
    this.isActive = false;
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

    this.closeDebugger.addEventListener("click", () => {
      this.hide();
      this.isActive = false;
    });

    this.debuggerContainer.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        this.applyChanges();
      }
    });

    this.applyChangesButton = await slice.build("Button", {
      value: "Apply Changes",
      onClickCallback: () => this.applyChanges(),
    });

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

  makeDraggable() {
    let offset = {
      x: 0,
      y: 0,
    };
    let isDragging = false;

    const header = this.querySelector(".debugger-header");

    header.addEventListener("mousedown", (event) => {
      isDragging = true;
      offset.x =
        event.clientX - this.debuggerContainer.getBoundingClientRect().left;
      offset.y =
        event.clientY - this.debuggerContainer.getBoundingClientRect().top;
    });

    document.addEventListener("mousemove", (event) => {
      if (isDragging) {
        const x = event.clientX - offset.x;
        const y = event.clientY - offset.y;

        this.debuggerContainer.style.left = `${x}px`;
        this.debuggerContainer.style.top = `${y}px`;
      }
    });

    header.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  handleDebugClick(event, component) {
    event.preventDefault();

    const debuggerWidth = this.debuggerContainer.offsetWidth;
    const debuggerHeight = this.debuggerContainer.offsetHeight;

    const leftOffset = (window.innerWidth - debuggerWidth) / 2;
    const topOffset = (window.innerHeight - debuggerHeight) / 2;

    this.debuggerContainer.style.left = `${leftOffset}px`;
    this.debuggerContainer.style.top = `${topOffset}px`;

    const sliceId = component.sliceId;
    this.isActive = true;

    const componentDetails = {
      SliceId: sliceId,
      ClassName: component.constructor.name,
      ComponentProps: {},
    };
    this.selectedComponentSliceId = component.sliceId; // Almacena el sliceId del componente seleccionado

    const realComponentProps = component.debuggerProps;

    realComponentProps.forEach((attr) => {
      if (component[attr] === undefined) {
        componentDetails.ComponentProps[attr] = component[`_${attr}`];
      } else {
        componentDetails.ComponentProps[attr] = component[attr];
      }
    });

    this.showComponentDetails(componentDetails);
  }

  showComponentDetails(details) {
    this.componentDetailsList.innerHTML = "";

    Object.entries(details).forEach(([key, value]) => {
      if (key === "ComponentProps") return;
      const listItem = document.createElement("li");
      listItem.textContent = `${key}: ${value}`;
      this.componentDetailsList.appendChild(listItem);
    });

    const ComponentPropsWithValues = this.getPropertiesWithValues(
      details.ComponentProps
    );

    if (ComponentPropsWithValues.length > 0) {
      this.createTable("", ComponentPropsWithValues, details);
    }

    this.debuggerContainer.classList.add("active");
    this.debuggerContainer.appendChild(this.applyChangesButton); // Agregar el botón al debugger
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

      // Crear un elemento editable para la celda de valor
      const valueInput = document.createElement("input");
      valueInput.value = details.ComponentProps[attr]; // Asignar el valor actual
      if (typeof details.ComponentProps[attr] === "function") {
        valueInput.disabled = true;
      }
      cell2.appendChild(valueInput);

      // Agregar evento de doble clic para permitir la edición
      cell2.addEventListener("dblclick", () => {
        valueInput.readOnly = false;
      });
    });

    tableContainer.appendChild(table);
    this.componentDetailsTable.appendChild(tableContainer);
  }

  getPropertiesWithValues(attributes) {
    return Object.keys(attributes).filter((attr) => attributes[attr] !== null);
  }


  applyChanges() {
    const inputCells = this.componentDetailsTable.querySelectorAll("td input");
    const selectedComponent = slice.controller.getComponent(
      this.selectedComponentSliceId
    );
    inputCells.forEach((inputCell) => {
      const attributeName =
        inputCell.parentElement.previousElementSibling.textContent;
      let newValue = inputCell.value;
      const oldValue = slice.controller.getComponent(
        this.selectedComponentSliceId
      )[attributeName];

      if (String(newValue) !== String(oldValue)) {
        if (typeof selectedComponent[attributeName] === "function") {
          return;
        }
        if (newValue === "true") newValue = true;
        if (newValue === "false") newValue = false;

        selectedComponent[attributeName] = newValue;
      }
    });
  }

  hide() {
    this.debuggerContainer.classList.remove("active");
  }
}

customElements.define("slice-debugger", Debugger);
