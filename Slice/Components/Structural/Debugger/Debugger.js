
export default class Debugger extends HTMLElement {
   constructor() {
      super();
      this.toggleClick = slice.debuggerConfig.click;
      this.toggle = 'click';
      this.selectedComponentSliceId = null;
      this.isActive = false;
   }

   async enableDebugMode() {
      //const html = await slice.controller.fetchText('Debugger', true, true, "/Slice/Components/Structural/Debugger/Debugger.html" );

      const html = `
      <div id="debugger-container">
  <div class="debugger-header">
    <div id="close-debugger">[×]</div>
    <h3>Component Details</h3>
  </div>
  <div id="component-details">
    <ul class="component-details-list"></ul>
    <div class="component-details-table"></div>
  </div>
</div>`





      this.innerHTML = html;
      //const css = await slice.controller.fetchText('Debugger', true, true, "/Slice/Components/Structural/Debugger/Debugger.css");
      const css = `
         #debugger-container {
  font-family: var(--font-family);
  display: none;
  position: fixed;
  top: 20px;
  left: 20px;
  padding: 10px;
  border: var(--slice-border) solid var(--primary-color);
  background-color: var(--primary-background-color);
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

#debugger-container.active {
  display: block;
}

.slice_thead td {
  font-weight: bold;
  background-color: var(--primary-color);
  color: var(--primary-color-contrast);
}

#close-debugger {
  cursor: pointer;
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 14px;
  color: var(--danger-color);
}

h3 {
  color: var(--primary-color);
  margin-bottom: 10px;
}

#component-details {
  color: var(--font-primary-color);
}
.component-details-table {
  overflow: scroll;
  input {
    outline: none;
    border-bottom: 1px solid var(--tertiary-background-color);
  }
}
.component-details-table::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.component-details-table::-webkit-scrollbar-thumb {
  background: var(--secondary-color);
  border-radius: var(--border-radius-slice);
}

#component-details table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  /* border: 1px solid var(--primary-color); */
}

.debugger-header {
  border-bottom: 1px solid var(--primary-color);
  user-select: none;
  cursor: grab;
}

.debugger-header:active {
  cursor: grabbing;
}

#component-details th,
#component-details td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid var(--primary-color);
}

input {
  border: 0px;
}

.slice_component-details td,
input {
  background-color: var(--secondary-background-color);
  color: var(--font-primary-color);
}

/* Estilo para las filas impares, solo para mejorar la legibilidad */
#component-details tr:nth-child(odd) {
  background-color: #f9f9f9;
}

      `

      slice.stylesManager.registerComponentStyles('Debugger', css);

      this.debuggerContainer = this.querySelector('#debugger-container');
      this.closeDebugger = this.querySelector('#close-debugger');
      this.componentDetails = this.querySelector('#component-details');
      this.componentDetailsTable = this.querySelector('.component-details-table');
      this.componentDetailsList = this.querySelector('.component-details-list');

      this.closeDebugger.addEventListener('click', () => {
         this.hide();
         this.isActive = false;
      });

      this.debuggerContainer.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
            this.applyChanges();
         }
      });

      this.applyChangesButton = await slice.build('Button', {
         value: 'Apply Changes',
         onClickCallback: () => this.applyChanges(),
      });

      // Arrastrar y soltar
      this.makeDraggable();

      slice.logger.logInfo('Logger', 'Debug mode enabled');
      return true;
   }

   attachDebugMode(component) {
      if (this.toggleClick === 'right') {
         this.toggle = 'contextmenu';
      } else {
         this.toggle = 'click';
      }
      component.addEventListener(this.toggle, (event) => this.handleDebugClick(event, component));
   }

   makeDraggable() {
      let offset = {
         x: 0,
         y: 0,
      };
      let isDragging = false;

      const header = this.querySelector('.debugger-header');

      header.addEventListener('mousedown', (event) => {
         isDragging = true;
         offset.x = event.clientX - this.debuggerContainer.getBoundingClientRect().left;
         offset.y = event.clientY - this.debuggerContainer.getBoundingClientRect().top;
      });

      document.addEventListener('mousemove', (event) => {
         if (isDragging) {
            const x = event.clientX - offset.x;
            const y = event.clientY - offset.y;

            this.debuggerContainer.style.left = `${x}px`;
            this.debuggerContainer.style.top = `${y}px`;
         }
      });

      header.addEventListener('mouseup', () => {
         isDragging = false;
      });
   }

   handleDebugClick(event, component) {
      event.preventDefault();
      event.stopPropagation();

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
      this.componentDetailsList.innerHTML = '';

      Object.entries(details).forEach(([key, value]) => {
         if (key === 'ComponentProps') return;
         const listItem = document.createElement('li');
         listItem.textContent = `${key}: ${value}`;
         this.componentDetailsList.appendChild(listItem);
      });

      const ComponentPropsWithValues = this.getPropertiesWithValues(details.ComponentProps);

      if (ComponentPropsWithValues.length > 0) {
         this.createTable('', ComponentPropsWithValues, details);
      }

      this.debuggerContainer.classList.add('active');
      this.debuggerContainer.appendChild(this.applyChangesButton); // Agregar el botón al debugger
   }

   createTable(title, attributes, details) {
      this.componentDetailsTable.innerHTML = '';
      const tableContainer = document.createElement('div');
      tableContainer.classList.add('table-container');

      const titleElement = document.createElement('h4');
      titleElement.textContent = title;
      tableContainer.appendChild(titleElement);

      const table = document.createElement('table');
      const thead = table.createTHead();
      const tbody = table.createTBody();
      thead.classList.add('slice_thead');
      tbody.classList.add('slice_component-details');

      const headerRow = thead.insertRow();
      const headerCell1 = headerRow.insertCell(0);
      const headerCell2 = headerRow.insertCell(1);

      headerCell1.textContent = 'Attribute';
      headerCell2.textContent = 'Value';

      attributes.forEach((attr) => {
         const row = tbody.insertRow();
         const cell1 = row.insertCell(0);
         const cell2 = row.insertCell(1);

         cell1.textContent = attr;

         // Crear un elemento editable para la celda de valor
         const valueInput = document.createElement('input');
         valueInput.value = details.ComponentProps[attr]; // Asignar el valor actual
         if (typeof details.ComponentProps[attr] === 'function') {
            valueInput.disabled = true;
         }
         cell2.appendChild(valueInput);

         // Agregar evento de doble clic para permitir la edición
         cell2.addEventListener('dblclick', () => {
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
      const inputCells = this.componentDetailsTable.querySelectorAll('td input');
      const selectedComponent = slice.controller.getComponent(this.selectedComponentSliceId);
      inputCells.forEach((inputCell) => {
         const attributeName = inputCell.parentElement.previousElementSibling.textContent;
         let newValue = inputCell.value;
         const oldValue = slice.controller.getComponent(this.selectedComponentSliceId)[attributeName];

         if (String(newValue) !== String(oldValue)) {
            if (typeof selectedComponent[attributeName] === 'function') {
               return;
            }
            if (newValue === 'true') newValue = true;
            if (newValue === 'false') newValue = false;

            selectedComponent[attributeName] = newValue;
         }
      });
   }

   hide() {
      this.debuggerContainer.classList.remove('active');
   }
}

customElements.define('slice-debugger', Debugger);
