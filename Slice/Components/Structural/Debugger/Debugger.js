// ✅ VERSIÓN ANTI-INTERFERENCIA - Aislada del Router y con debugging

export default class Debugger extends HTMLElement {
   constructor() {
      super();
      this.toggleClick = slice.debuggerConfig.click;
      this.toggle = 'click';
      this.selectedComponentSliceId = null;
      this.isActive = false;
      this.activeTab = 'props';
      this.currentComponent = null;
      this.componentProps = {};
      this.currentEditingProp = null;
      this.currentEditingType = null;
      
      // ✅ Flag para prevenir interferencias externas
      this.isDebuggerInput = false;
   }

   async enableDebugMode() {
      //const html = await slice.controller.fetchText('Debugger', 'html', 'Structural');
      //const css = await slice.controller.fetchText('Debugger', 'css', 'Structural');

      const html = productionOnlyHtml();
      const css = productionOnlyCSS();

      this.innerHTML = html;
      slice.stylesManager.registerComponentStyles('Debugger', css);

      this.setupElements();
      this.setupEventListeners();
      this.makeDraggable();

      slice.logger.logInfo('Debugger', 'Advanced Debug mode enabled');
      return true;
   }

   setupElements() {
      this.debuggerContainer = this.querySelector('#debugger-container');
      this.closeDebugger = this.querySelector('#close-debugger');
      this.propsContainer = this.querySelector('.props-container');
      this.infoContainer = this.querySelector('.info-list');
      this.editorModal = this.querySelector('#editor-modal');
      this.propertyEditor = this.querySelector('#property-editor');
      this.modalTitle = this.querySelector('#modal-title');
      this.validationMessage = this.querySelector('.validation-message');
      
      // Header elements
      this.componentName = this.querySelector('.component-name');
      this.componentId = this.querySelector('.component-id');
   }

   setupEventListeners() {
      // Tab navigation
      this.querySelectorAll('.tab-btn').forEach(btn => {
         btn.addEventListener('click', (e) => {
            this.switchTab(e.target.dataset.tab);
         });
      });

      // Close and minimize
      this.closeDebugger.addEventListener('click', () => {
         this.hide();
         this.isActive = false;
      });

      // Modal events
      this.querySelector('#modal-close').addEventListener('click', () => {
         this.closeModal();
      });

      this.querySelector('#modal-cancel').addEventListener('click', () => {
         this.closeModal();
      });

      this.querySelector('#modal-save').addEventListener('click', () => {
         this.savePropertyValue();
      });

      // Editor type selector
      this.querySelectorAll('.type-btn').forEach(btn => {
         btn.addEventListener('click', (e) => {
            this.switchEditorType(e.target.dataset.type);
         });
      });

      // Action buttons
      this.querySelector('#apply-changes')?.addEventListener('click', (e) => {
         e.stopPropagation();
         this.applyAllChanges();
      });

      this.querySelector('#reset-values')?.addEventListener('click', (e) => {
         e.stopPropagation();
         this.resetValues();
      });

      // Property editor validation
      this.propertyEditor.addEventListener('input', () => {
         this.validateEditor();
      });

      // Modal backdrop click
      this.editorModal.addEventListener('click', (e) => {
         if (e.target === this.editorModal) {
            this.closeModal();
         }
      });

      // ✅ EVENTOS PRINCIPALES - Con protección anti-interferencia
      this.addEventListener('mousedown', (event) => {
         if (event.target.classList.contains('prop-control')) {
            this.isDebuggerInput = true;
            // Prevenir interferencias del Router u otros sistemas
            event.stopPropagation();
         }
      });

      this.addEventListener('focus', (event) => {
         if (event.target.classList.contains('prop-control')) {
            this.isDebuggerInput = true;
            event.stopPropagation();
         }
      }, true);

      this.addEventListener('blur', (event) => {
         if (event.target.classList.contains('prop-control')) {
            this.isDebuggerInput = false;
         }
      }, true);

      this.addEventListener('keypress', (event) => {
         if (event.key === 'Enter' && event.target.classList.contains('prop-control')) {
            event.preventDefault();
            event.stopPropagation();
            this.applyPropertyChange(event.target);
         }
      });

      this.addEventListener('change', (event) => {
         if (event.target.type === 'checkbox' && event.target.classList.contains('prop-control')) {
            event.stopPropagation();
            this.applyPropertyChange(event.target);
         }
      });

      // ✅ PROTECCIÓN GLOBAL: Prevenir que eventos externos interfieran
      this.addEventListener('click', (event) => {
         if (this.contains(event.target)) {
            event.stopPropagation();
         }
      });

      // ✅ Los eventos DOMNodeInserted/Removed están deprecated, 
      // pero la protección con stopPropagation() ya es suficiente
   }

   switchTab(tabName) {
      this.activeTab = tabName;
      
      this.querySelectorAll('.tab-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      this.querySelectorAll('.tab-pane').forEach(pane => {
         pane.classList.toggle('active', pane.id === `${tabName}-tab`);
      });
   }

   switchEditorType(type) {
      this.querySelectorAll('.type-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.type === type);
      });
      this.currentEditingType = type;
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
      let offset = { x: 0, y: 0 };
      let isDragging = false;

      const header = this.querySelector('.debugger-header');

      header.addEventListener('mousedown', (event) => {
         isDragging = true;
         offset.x = event.clientX - this.debuggerContainer.getBoundingClientRect().left;
         offset.y = event.clientY - this.debuggerContainer.getBoundingClientRect().top;
         header.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', (event) => {
         if (isDragging) {
            const x = event.clientX - offset.x;
            const y = event.clientY - offset.y;
            this.debuggerContainer.style.left = `${x}px`;
            this.debuggerContainer.style.top = `${y}px`;
            this.debuggerContainer.style.right = 'auto';
         }
      });

      document.addEventListener('mouseup', () => {
         if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';
         }
      });
   }

   handleDebugClick(event, component) {
      event.preventDefault();
      event.stopPropagation();

      this.selectedComponentSliceId = component.sliceId;
      this.currentComponent = component;
      this.isActive = true;

      // Update header info
      this.componentName.textContent = component.constructor.name;
      this.componentId.textContent = `ID: ${component.sliceId}`;

      // Gather component data
      const realComponentProps = this.getComponentPropsForDebugger(component);
      this.componentProps = {};

      realComponentProps.forEach((attr) => {
         if (component[attr] === undefined) {
            this.componentProps[attr] = component[`_${attr}`];
         } else {
            this.componentProps[attr] = component[attr];
         }
      });

      // ✅ Crear UI sin interferencias
      this.updateDebuggerContent();
      this.debuggerContainer.classList.add('active');
   }

   updateDebuggerContent() {
      this.updatePropsTab();
      this.updateInfoTab();
   }

   updatePropsTab() {
      const propsContainer = this.querySelector('.props-container');
      if (!propsContainer) {
         return;
      }
      
      propsContainer.innerHTML = '';

      const realComponentProps = this.getComponentPropsForDebugger(this.currentComponent);
      const ComponentClass = this.currentComponent.constructor;
      const configuredProps = ComponentClass.props || {};

      realComponentProps.forEach(prop => {
         const propElement = this.createPropElement(prop, configuredProps[prop]);
         propsContainer.appendChild(propElement);
      });
   }

   createPropElement(prop, config = {}) {
      const propWrapper = document.createElement('div');
      propWrapper.className = 'prop-item';
      propWrapper.dataset.prop = prop;

      const currentValue = this.currentComponent[prop];
      const valueType = this.getValueType(currentValue);

      // Status based on usage
      let status, statusClass;
      if (currentValue !== undefined && currentValue !== null) {
         status = 'Used';
         statusClass = 'status-used';
      } else if (config.required) {
         status = 'Missing';
         statusClass = 'status-missing';
      } else {
         status = 'Optional';
         statusClass = 'status-optional';
      }

      propWrapper.innerHTML = `
         <div class="prop-header">
            <div class="prop-title">
               <strong>${prop}</strong>
               <span class="prop-type">${valueType}</span>
            </div>
            <div class="prop-status ${statusClass}">${status}</div>
         </div>
         <div class="prop-input">
            ${this.createInputForType(prop, currentValue, valueType, config)}
         </div>
         ${config.default !== undefined ? `<div class="default-value">Default: ${JSON.stringify(config.default)}</div>` : ''}
      `;

      return propWrapper;
   }

   createInputForType(prop, value, type, config = {}) {
      const serializedValue = this.serializeValue(value);
      
      if (type === 'boolean') {
         return `
            <div class="input-group">
               <input type="checkbox" 
                      class="prop-control debugger-input" 
                      data-prop="${prop}" 
                      ${value ? 'checked' : ''}
                      data-debugger-input="true">
               <span class="checkbox-label">${value ? 'true' : 'false'}</span>
            </div>
         `;
      } else if (type === 'number') {
         return `
            <div class="input-group">
               <input type="number" 
                      class="prop-control debugger-input" 
                      data-prop="${prop}" 
                      value="${serializedValue}"
                      step="any"
                      placeholder="Enter number..."
                      data-debugger-input="true">
            </div>
         `;
      } else if (type === 'object' || type === 'array' || type === 'function') {
         return `
            <div class="input-group">
               <input type="text" 
                      class="prop-control debugger-input" 
                      data-prop="${prop}" 
                      value="${serializedValue}"
                      readonly
                      title="Click edit button to modify"
                      data-debugger-input="true">
               <button class="edit-btn" onclick="slice.debugger.openAdvancedEditor('${prop}', '${type}')">✏️</button>
            </div>
         `;
      } else {
         return `
            <div class="input-group">
               <input type="text" 
                      class="prop-control debugger-input" 
                      data-prop="${prop}" 
                      value="${serializedValue}"
                      placeholder="Enter value..."
                      data-debugger-input="true">
            </div>
         `;
      }
   }

   applyPropertyChange(inputElement) {
      const prop = inputElement.dataset.prop;
      if (!prop) return;

      let newValue;
      
      if (inputElement.type === 'checkbox') {
         newValue = inputElement.checked;
         const label = inputElement.parentNode.querySelector('.checkbox-label');
         if (label) {
            label.textContent = newValue ? 'true' : 'false';
         }
      } else if (inputElement.type === 'number') {
         newValue = Number(inputElement.value);
      } else {
         newValue = inputElement.value;
         
         // Convert string values
         if (newValue === 'true') newValue = true;
         if (newValue === 'false') newValue = false;
         if (!isNaN(newValue) && newValue !== '' && newValue !== null) newValue = Number(newValue);
      }

      const oldValue = this.currentComponent[prop];
      
      this.currentComponent[prop] = newValue;
      slice.logger.logInfo('Debugger', `Updated ${prop}: ${oldValue} → ${newValue}`);
      
      this.showVisualFeedback(inputElement);
   }

   showVisualFeedback(inputElement) {
      const originalBorder = inputElement.style.borderColor;
      const originalBoxShadow = inputElement.style.boxShadow;
      
      inputElement.style.borderColor = '#4CAF50';
      inputElement.style.boxShadow = '0 0 0 2px rgba(76, 175, 80, 0.3)';
      
      setTimeout(() => {
         inputElement.style.borderColor = originalBorder;
         inputElement.style.boxShadow = originalBoxShadow;
      }, 1500);
   }

   applyAllChanges() {
      const inputs = this.querySelectorAll('.prop-control:not([readonly])');
      let changeCount = 0;
      
      inputs.forEach(input => {
         if (!input.readOnly) {
            this.applyPropertyChange(input);
            changeCount++;
         }
      });

      slice.logger.logInfo('Debugger', `Applied ${changeCount} property changes`);
      this.showApplyFeedback(changeCount);
   }

   showApplyFeedback(changeCount) {
      const applyBtn = this.querySelector('#apply-changes');
      if (!applyBtn) return;
      
      const originalText = applyBtn.textContent;
      
      if (changeCount > 0) {
         applyBtn.textContent = `✅ Applied ${changeCount} changes!`;
         applyBtn.style.background = '#4CAF50';
      } else {
         applyBtn.textContent = '✅ No changes to apply';
         applyBtn.style.background = '#9E9E9E';
      }
      
      setTimeout(() => {
         applyBtn.textContent = originalText;
         applyBtn.style.background = '';
      }, 2000);
   }

   openAdvancedEditor(prop, type) {
      this.currentEditingProp = prop;
      this.currentEditingType = type;
      
      const value = this.currentComponent[prop];
      
      this.modalTitle.textContent = `Edit ${prop} (${type})`;
      
      this.querySelectorAll('.type-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.type === type);
      });
      
      if (type === 'function') {
         if (typeof value === 'function') {
            this.propertyEditor.value = value.toString();
         } else {
            this.propertyEditor.value = 'function() {\n   // Your code here\n}';
         }
      } else {
         this.propertyEditor.value = JSON.stringify(value, null, 2);
      }
      
      this.editorModal.classList.add('active');
      this.propertyEditor.focus();
   }

   validateEditor() {
      const value = this.propertyEditor.value.trim();
      const type = this.currentEditingType;
      
      try {
         if (type === 'function') {
            new Function('return ' + value)();
         } else {
            JSON.parse(value);
         }
         
         this.validationMessage.textContent = '✅ Valid syntax';
         this.validationMessage.style.color = '#4CAF50';
         this.querySelector('#modal-save').disabled = false;
      } catch (error) {
         this.validationMessage.textContent = `❌ ${error.message}`;
         this.validationMessage.style.color = '#F44336';
         this.querySelector('#modal-save').disabled = true;
      }
   }

   savePropertyValue() {
      const value = this.propertyEditor.value.trim();
      const type = this.currentEditingType;
      
      try {
         let newValue;
         
         if (type === 'function') {
            newValue = new Function('return ' + value)();
         } else {
            newValue = JSON.parse(value);
         }
         
         this.currentComponent[this.currentEditingProp] = newValue;
         this.closeModal();
         
         slice.logger.logInfo('Debugger', `Updated ${this.currentEditingProp} via advanced editor`);
         
         const input = this.querySelector(`[data-prop="${this.currentEditingProp}"]`);
         if (input) {
            input.value = this.serializeValue(newValue);
            this.showVisualFeedback(input);
         }
         
      } catch (error) {
         this.validationMessage.textContent = `❌ ${error.message}`;
         this.validationMessage.style.color = '#F44336';
      }
   }

   closeModal() {
      this.editorModal.classList.remove('active');
      this.currentEditingProp = null;
      this.currentEditingType = null;
      this.validationMessage.textContent = '';
   }

   resetValues() {
      const ComponentClass = this.currentComponent.constructor;
      const configuredProps = ComponentClass.props || {};
      let resetCount = 0;

      Object.entries(configuredProps).forEach(([prop, config]) => {
         if (config.default !== undefined) {
            this.currentComponent[prop] = config.default;
            
            const input = this.querySelector(`[data-prop="${prop}"]`);
            if (input && !input.readOnly) {
               if (input.type === 'checkbox') {
                  input.checked = config.default;
                  const label = input.parentNode.querySelector('.checkbox-label');
                  if (label) {
                     label.textContent = config.default ? 'true' : 'false';
                  }
               } else {
                  input.value = this.serializeValue(config.default);
               }
               resetCount++;
            }
         }
      });

      slice.logger.logInfo('Debugger', 'Reset values to defaults');
      this.showResetFeedback(resetCount);
   }

   showResetFeedback(resetCount) {
      const resetBtn = this.querySelector('#reset-values');
      if (!resetBtn) return;
      
      const originalText = resetBtn.textContent;
      
      resetBtn.textContent = `🔄 Reset ${resetCount} values!`;
      resetBtn.style.background = '#FF9800';
      
      setTimeout(() => {
         resetBtn.textContent = originalText;
         resetBtn.style.background = '';
      }, 1500);
   }

   updateInfoTab() {
      const infoContainer = this.querySelector('.info-list');
      if (!infoContainer) return;
      
      const component = this.currentComponent;
      
      const info = [
         { label: 'Component Type', value: component.constructor.name },
         { label: 'Slice ID', value: component.sliceId || 'Not assigned' },
         { label: 'Tag Name', value: component.tagName },
         { label: 'Connected', value: component.isConnected ? 'Yes' : 'No' },
         { label: 'Props Count', value: Object.keys(this.componentProps).length },
         { label: 'Children', value: component.children.length }
      ];
      
      infoContainer.innerHTML = info.map(item => `
         <div class="info-item">
            <span class="info-label">${item.label}</span>
            <span class="info-value">${item.value}</span>
         </div>
      `).join('');
   }

   getValueType(value) {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (Array.isArray(value)) return 'array';
      return typeof value;
   }

   serializeValue(value) {
      if (value === null || value === undefined) {
         return '';
      }
      
      if (typeof value === 'object' || typeof value === 'function') {
         try {
            return JSON.stringify(value);
         } catch {
            return String(value);
         }
      }
      
      return String(value);
   }

   getComponentPropsForDebugger(component) {
      const ComponentClass = component.constructor;
      
      if (ComponentClass.props) {
         return Object.keys(ComponentClass.props);
      }
      
      if (component.debuggerProps && Array.isArray(component.debuggerProps)) {
         return component.debuggerProps;
      }
      
      return this.detectUsedProps(component);
   }

   detectUsedProps(component) {
      const usedProps = [];
      
      Object.getOwnPropertyNames(component).forEach(key => {
         if (key.startsWith('_') && key !== '_isActive') {
            const propName = key.substring(1);
            usedProps.push(propName);
         }
      });
      
      return usedProps;
   }

   hide() {
      this.debuggerContainer.classList.remove('active');
      this.closeModal();
   }
}

customElements.define('slice-debugger', Debugger);

function productionOnlyCSS(){
   return `
   #debugger-container {
   font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
   display: none;
   position: fixed;
   top: 20px;
   right: 20px;
   width: 420px;
   height: 85vh;
   max-height: 85vh;
   background: var(--primary-background-color);
   border: 1px solid var(--medium-color);
   border-radius: 12px;
   box-shadow: 0 20px 40px rgba(var(--primary-color-rgb), 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
   z-index: 10000;
   overflow: hidden;
   backdrop-filter: blur(10px);
}

#debugger-container.active {
   display: flex;
   flex-direction: column;
}

.debugger-header {
   background: linear-gradient(135deg, var(--primary-color), var(--primary-color-shade));
   color: var(--primary-color-contrast);
   padding: 12px 16px;
   border-radius: 12px 12px 0 0;
   user-select: none;
   cursor: grab;
}

.debugger-header:active {
   cursor: grabbing;
}

.header-content {
   display: flex;
   justify-content: space-between;
   align-items: center;
}

.component-info {
   display: flex;
   align-items: center;
   gap: 10px;
}

.component-icon {
   font-size: 20px;
   opacity: 0.9;
}

.component-name {
   font-size: 14px;
   font-weight: 600;
   margin-bottom: 2px;
}

.component-id {
   font-size: 11px;
   opacity: 0.8;
}

.header-actions {
   display: flex;
   gap: 8px;
}

.minimize-btn, #close-debugger {
   background: rgba(255, 255, 255, 0.2);
   border: none;
   color: var(--primary-color-contrast);
   width: 28px;
   height: 28px;
   border-radius: 6px;
   cursor: pointer;
   display: flex;
   align-items: center;
   justify-content: center;
   font-size: 16px;
   font-weight: bold;
   transition: background 0.2s ease;
}

.minimize-btn:hover, #close-debugger:hover {
   background: rgba(255, 255, 255, 0.3);
}

.debugger-content {
   flex: 1;
   display: flex;
   flex-direction: column;
   overflow: hidden;
}

.tabs-container {
   border-bottom: 1px solid var(--medium-color);
}

.tab-nav {
   display: flex;
   background: var(--tertiary-background-color);
}

.tab-btn {
   flex: 1;
   padding: 10px 14px;
   border: none;
   background: transparent;
   color: var(--font-secondary-color);
   font-size: 12px;
   font-weight: 500;
   cursor: pointer;
   transition: all 0.2s ease;
   border-bottom: 2px solid transparent;
}

.tab-btn:hover {
   background: var(--secondary-background-color);
   color: var(--font-primary-color);
}

.tab-btn.active {
   background: var(--primary-background-color);
   color: var(--primary-color);
   border-bottom-color: var(--primary-color);
   font-weight: 600;
}

.tab-content {
   flex: 1;
   overflow: hidden;
   height: calc(85vh - 100px);
}

.tab-pane {
   display: none;
   height: 100%;
   overflow-y: auto;
   overflow-x: hidden;
   padding: 16px;
}

.tab-pane.active {
   display: block;
}

.tab-pane::-webkit-scrollbar {
   width: 4px;
}

.tab-pane::-webkit-scrollbar-track {
   background: var(--tertiary-background-color);
   border-radius: 2px;
}

.tab-pane::-webkit-scrollbar-thumb {
   background: var(--medium-color);
   border-radius: 2px;
}

.tab-pane::-webkit-scrollbar-thumb:hover {
   background: var(--primary-color);
}

.props-container {
   display: flex;
   flex-direction: column;
   gap: 12px;
   margin-bottom: 16px;
}

.props-actions {
   border-top: 1px solid var(--medium-color);
   padding-top: 16px;
   margin-top: 8px;
}

.actions-note {
   margin-top: 12px;
   padding: 8px 12px;
   background: var(--tertiary-background-color);
   border-radius: 6px;
   border: 1px solid var(--medium-color);
}

.actions-note small {
   color: var(--font-secondary-color);
   font-size: 11px;
   display: flex;
   align-items: center;
   gap: 6px;
}

.props-section {
   background: var(--tertiary-background-color);
   border: 1px solid var(--medium-color);
   border-radius: 8px;
   padding: 12px;
}

.section-title {
   font-size: 12px;
   font-weight: 600;
   color: var(--font-primary-color);
   margin-bottom: 12px;
   display: flex;
   align-items: center;
   gap: 6px;
}

.prop-item {
   display: flex;
   flex-direction: column;
   gap: 6px;
   padding: 12px;
   background: var(--primary-background-color);
   border: 1px solid var(--medium-color);
   border-radius: 6px;
   margin-bottom: 8px;
   transition: border-color 0.2s ease;
}

.prop-item:hover {
   border-color: var(--primary-color);
}

.prop-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
}

.prop-name {
   font-size: 13px;
   font-weight: 600;
   color: var(--font-primary-color);
}

.prop-name.required::after {
   content: " *";
   color: var(--danger-color);
}

.prop-meta {
   display: flex;
   align-items: center;
   gap: 8px;
}

.prop-type {
   font-size: 11px;
   padding: 2px 6px;
   background: var(--secondary-color);
   color: var(--secondary-color-contrast);
   border-radius: 4px;
   font-family: monospace;
   font-weight: 500;
}

.prop-status {
   font-size: 12px;
   font-weight: 500;
}

.status-used {
   color: var(--success-color);
}

.status-missing {
   color: var(--danger-color);
}

.status-optional {
   color: var(--medium-color);
}

.prop-input {
   margin-top: 8px;
}

.input-group {
   position: relative;
}

.prop-control {
   width: 100%;
   padding: 8px 32px 8px 10px;
   border: 1px solid var(--medium-color);
   border-radius: 6px;
   background: var(--primary-background-color);
   color: var(--font-primary-color);
   font-size: 13px;
   transition: border-color 0.2s ease, box-shadow 0.2s ease;
   font-family: monospace;
}

.prop-control:focus {
   outline: none;
   border-color: var(--primary-color);
   box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
}

.prop-control:disabled {
   background: var(--disabled-color);
   color: var(--font-secondary-color);
   cursor: not-allowed;
}

.prop-control[readonly] {
   background: var(--tertiary-background-color);
   cursor: pointer;
}

.prop-control[readonly]:focus {
   border-color: var(--accent-color);
   box-shadow: 0 0 0 3px rgba(var(--accent-color), 0.1);
}

/* Estilos específicos para checkboxes */
.prop-control[type="checkbox"] {
   width: auto;
   padding: 0;
   margin: 0;
   cursor: pointer;
}

.edit-btn {
   position: absolute;
   right: 4px;
   top: 50%;
   transform: translateY(-50%);
   background: var(--accent-color);
   border: none;
   color: white;
   width: 24px;
   height: 24px;
   border-radius: 4px;
   cursor: pointer;
   font-size: 12px;
   display: flex;
   align-items: center;
   justify-content: center;
   transition: background 0.2s ease;
}

.edit-btn:hover {
   background: var(--primary-color);
}

.default-value {
   font-size: 11px;
   color: var(--font-secondary-color);
   font-style: italic;
   margin-top: 4px;
}

.info-list {
   display: flex;
   flex-direction: column;
   gap: 12px;
}

.info-item {
   display: flex;
   justify-content: space-between;
   padding: 12px;
   background: var(--tertiary-background-color);
   border-radius: 6px;
   border: 1px solid var(--medium-color);
}

.info-label {
   font-weight: 600;
   color: var(--font-primary-color);
   font-size: 13px;
}

.info-value {
   color: var(--font-secondary-color);
   font-family: monospace;
   font-size: 12px;
}

.actions-container {
   display: flex;
   flex-direction: column;
   gap: 16px;
}

.action-buttons {
   display: flex;
   flex-direction: column;
   gap: 8px;
}

.action-btn {
   padding: 12px 16px;
   border: none;
   border-radius: 6px;
   font-size: 13px;
   font-weight: 500;
   cursor: pointer;
   transition: all 0.2s ease;
   display: flex;
   align-items: center;
   justify-content: center;
   gap: 8px;
}

.action-btn.primary {
   background: var(--primary-color);
   color: var(--primary-color-contrast);
}

.action-btn.primary:hover {
   background: var(--primary-color-shade);
}

.action-btn.secondary {
   background: var(--secondary-color);
   color: var(--secondary-color-contrast);
}

.action-btn.secondary:hover {
   opacity: 0.9;
}

.action-btn.tertiary {
   background: var(--tertiary-background-color);
   color: var(--font-primary-color);
   border: 1px solid var(--medium-color);
}

.action-btn.tertiary:hover {
   background: var(--secondary-background-color);
}

/* Modal Styles */
.editor-modal {
   display: none;
   position: fixed;
   top: 0;
   left: 0;
   width: 100%;
   height: 100%;
   background: rgba(0, 0, 0, 0.6);
   z-index: 20000;
   backdrop-filter: blur(4px);
}

.editor-modal.active {
   display: flex;
   align-items: center;
   justify-content: center;
}

.modal-content {
   background: var(--primary-background-color);
   border-radius: 12px;
   width: 90%;
   max-width: 600px;
   max-height: 80%;
   display: flex;
   flex-direction: column;
   box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
   border: 1px solid var(--medium-color);
}

.modal-header {
   padding: 16px 20px;
   background: var(--tertiary-background-color);
   border-radius: 12px 12px 0 0;
   border-bottom: 1px solid var(--medium-color);
   display: flex;
   justify-content: space-between;
   align-items: center;
}

.modal-header h3 {
   margin: 0;
   font-size: 16px;
   font-weight: 600;
   color: var(--font-primary-color);
}

.modal-close {
   background: none;
   border: none;
   font-size: 20px;
   color: var(--font-secondary-color);
   cursor: pointer;
   width: 32px;
   height: 32px;
   border-radius: 6px;
   display: flex;
   align-items: center;
   justify-content: center;
   transition: background 0.2s ease;
}

.modal-close:hover {
   background: var(--secondary-background-color);
}

.modal-body {
   flex: 1;
   padding: 20px;
   display: flex;
   flex-direction: column;
   gap: 16px;
   overflow: hidden;
}

.editor-type-selector {
   display: flex;
   gap: 4px;
   background: var(--tertiary-background-color);
   padding: 4px;
   border-radius: 6px;
}

.type-btn {
   flex: 1;
   padding: 8px 12px;
   border: none;
   background: transparent;
   color: var(--font-secondary-color);
   font-size: 12px;
   font-weight: 500;
   cursor: pointer;
   border-radius: 4px;
   transition: all 0.2s ease;
}

.type-btn.active {
   background: var(--primary-color);
   color: var(--primary-color-contrast);
}

.editor-container {
   flex: 1;
   position: relative;
   min-height: 200px;
}

#property-editor {
   width: 100%;
   height: 100%;
   border: 1px solid var(--medium-color);
   border-radius: 6px;
   padding: 12px;
   background: var(--primary-background-color);
   color: var(--font-primary-color);
   font-family: 'Monaco', 'Consolas', monospace;
   font-size: 13px;
   line-height: 1.5;
   resize: none;
   outline: none;
   min-height: 200px;
}

#property-editor:focus {
   border-color: var(--primary-color);
   box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
}

.validation-message {
   font-size: 12px;
   color: var(--danger-color);
   min-height: 18px;
   display: flex;
   align-items: center;
   gap: 6px;
}

.modal-actions {
   padding: 16px 20px;
   background: var(--tertiary-background-color);
   border-radius: 0 0 12px 12px;
   border-top: 1px solid var(--medium-color);
   display: flex;
   gap: 12px;
   justify-content: flex-end;
}

.modal-btn {
   padding: 10px 20px;
   border: none;
   border-radius: 6px;
   font-size: 13px;
   font-weight: 500;
   cursor: pointer;
   transition: all 0.2s ease;
}

.modal-btn.cancel {
   background: var(--tertiary-background-color);
   color: var(--font-primary-color);
   border: 1px solid var(--medium-color);
}

.modal-btn.cancel:hover {
   background: var(--secondary-background-color);
}

.modal-btn.save {
   background: var(--success-color);
   color: var(--success-contrast);
}

.modal-btn.save:hover {
   opacity: 0.9;
}

.modal-btn.save:disabled {
   background: var(--disabled-color);
   cursor: not-allowed;
}
   `
}

function productionOnlyHtml(){
   return `
   <div id="debugger-container">
   <div class="debugger-header">
      <div class="header-content">
         <div class="component-info">
            <div class="component-icon">🔍</div>
            <div class="component-details">
               <div class="component-name">Component Inspector</div>
               <div class="component-id">Ready to debug</div>
            </div>
         </div>
         <div class="header-actions">
            <button class="minimize-btn" title="Minimize">−</button>
            <button id="close-debugger" title="Close">×</button>
         </div>
      </div>
   </div>
   
   <div class="debugger-content">
      <div class="tabs-container">
         <div class="tab-nav">
            <button class="tab-btn active" data-tab="props">📋 Props</button>
            <button class="tab-btn" data-tab="info">ℹ️ Info</button>
         </div>
      </div>
      
      <div class="tab-content">
         <div class="tab-pane active" id="props-tab">
            <div class="props-container"></div>
            <div class="props-actions">
               <div class="action-buttons">
                  <button class="action-btn primary" id="apply-changes">✅ Apply Changes</button>
                  <button class="action-btn secondary" id="reset-values">🔄 Reset Values</button>
               </div>
               <div class="actions-note">
                  <small>💡 Press Enter on any input to apply changes automatically</small>
               </div>
            </div>
         </div>
         
         <div class="tab-pane" id="info-tab">
            <div class="info-container">
               <div class="info-list"></div>
            </div>
         </div>
      </div>
   </div>
   
   <!-- Modal para editar objetos/funciones -->
   <div class="editor-modal" id="editor-modal">
      <div class="modal-content">
         <div class="modal-header">
            <h3 id="modal-title">Edit Property</h3>
            <button class="modal-close" id="modal-close">×</button>
         </div>
         <div class="modal-body">
            <div class="editor-type-selector">
               <button class="type-btn active" data-type="json">📋 JSON</button>
               <button class="type-btn" data-type="function">⚡ Function</button>
            </div>
            <div class="editor-container">
               <textarea id="property-editor" spellcheck="false"></textarea>
            </div>
            <div class="editor-footer">
               <div class="validation-message"></div>
            </div>
         </div>
         <div class="modal-actions">
            <button class="modal-btn cancel" id="modal-cancel">Cancel</button>
            <button class="modal-btn save" id="modal-save">Save Changes</button>
         </div>
      </div>
   </div>
</div>`
}