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
      const html = await slice.controller.fetchText('Debugger', 'html', 'Structural');
      const css = await slice.controller.fetchText('Debugger', 'css', 'Structural');

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