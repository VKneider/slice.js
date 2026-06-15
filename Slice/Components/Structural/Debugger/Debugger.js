// ✅ VERSIÓN ANTI-INTERFERENCIA - Aislada del Router y con debugging

/**
 * Runtime UI debugger for Slice components.
 */
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

   /**
    * Load debugger UI and enable interactions.
    * @returns {Promise<boolean>}
    */
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

   /**
    * Cache UI elements.
    * @returns {void}
    */
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

   /**
    * Bind UI event listeners.
    * @returns {void}
    */
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

   /**
    * Switch active tab.
    * @param {string} tabName
    * @returns {void}
    */
   switchTab(tabName) {
      this.activeTab = tabName;
      
      this.querySelectorAll('.tab-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      this.querySelectorAll('.tab-pane').forEach(pane => {
         pane.classList.toggle('active', pane.id === `${tabName}-tab`);
      });
   }

   /**
    * Switch editor type (json | function).
    * @param {string} type
    * @returns {void}
    */
   switchEditorType(type) {
      const normalized = this.normalizeEditorType(type);
      if (!normalized) {
         return;
      }
      this.querySelectorAll('.type-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.type === normalized);
      });
      this.currentEditingType = normalized;
   }

   /**
    * Normalize editor type to supported values.
    * @param {string} type
    * @returns {string|null}
    */
   normalizeEditorType(type) {
      if (type === 'json' || type === 'function') {
         return type;
      }
      return null;
   }

   /**
    * Attach debugger toggle handler to a component.
    * @param {HTMLElement} component
    * @returns {void}
    */
   attachDebugMode(component) {
      if (this.toggleClick === 'right') {
         this.toggle = 'contextmenu';
      } else {
         this.toggle = 'click';
      }
      component.addEventListener(this.toggle, (event) => this.handleDebugClick(event, component));
   }

   /**
    * Enable drag interaction for the debugger panel.
    * @returns {void}
    */
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

   /**
    * Handle toggle click and load component info.
    * @param {Event} event
    * @param {HTMLElement} component
    * @returns {void}
    */
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

   /**
    * Render props tab content.
    * @returns {void}
    */
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

   /**
    * Build a prop row element.
    * @param {string} prop
    * @param {Object} [config]
    * @returns {HTMLElement}
    */
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
          ${(() => {
             if (config.default === undefined) return '';
             try { return `<div class="default-value">Default: ${JSON.stringify(config.default)}</div>`; }
             catch { return `<div class="default-value">Default: ${String(config.default)}</div>`; }
          })()}
      `;

      return propWrapper;
   }

   /**
    * Build input HTML for a prop type.
    * @param {string} prop
    * @param {any} value
    * @param {string} type
    * @param {Object} [config]
    * @returns {string}
    */
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

   /**
    * Apply a single prop change from an input.
    * @param {HTMLInputElement} inputElement
    * @returns {void}
    */
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

   /**
    * Show temporary highlight on updated input.
    * @param {HTMLElement} inputElement
    * @returns {void}
    */
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

   /**
    * Apply all editable prop changes in the panel.
    * @returns {void}
    */
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

   /**
    * Show apply feedback in button.
    * @param {number} changeCount
    * @returns {void}
    */
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

   /**
    * Open advanced editor for objects/functions.
    * @param {string} prop
    * @param {string} type
    * @returns {void}
    */
   openAdvancedEditor(prop, type) {
      this.currentEditingProp = prop;
      this.currentEditingType = this.normalizeEditorType(type) || 'json';
      
      const value = this.currentComponent[prop];
      
      this.modalTitle.textContent = `Edit ${prop} (${this.currentEditingType})`;
      
      this.querySelectorAll('.type-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.type === this.currentEditingType);
      });
      
      if (this.currentEditingType === 'function') {
         if (typeof value === 'function') {
            this.propertyEditor.value = value.toString();
         } else {
            this.propertyEditor.value = 'function() {\n   // Your code here\n}';
         }
      } else {
         try {
            this.propertyEditor.value = JSON.stringify(value, null, 2);
         } catch (error) {
            slice.logger?.warn?.('Debugger', 'Error serializing property value for editor', error);
            this.propertyEditor.value = `/* Error: ${error.message} */`;
         }
      }
      
      this.editorModal.classList.add('active');
      this.propertyEditor.focus();
   }

   /**
    * Validate editor contents for current type.
    * @returns {void}
    */
   validateEditor() {
      const value = this.propertyEditor.value.trim();
      const type = this.normalizeEditorType(this.currentEditingType) || 'json';
      
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
         slice.logger?.warn?.('Debugger', 'Validation error in editor', error);
      }
   }

   /**
    * Save editor value to component.
    * @returns {void}
    */
   savePropertyValue() {
      const value = this.propertyEditor.value.trim();
      const type = this.normalizeEditorType(this.currentEditingType) || 'json';
      
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
         slice.logger?.error?.('Debugger', `Failed to save ${this.currentEditingProp}`, error);
      }
   }

   /**
    * Close the advanced editor modal.
    * @returns {void}
    */
    closeModal() {
      this.editorModal.classList.remove('active');
      this.currentEditingProp = null;
      this.currentEditingType = null;
      this.validationMessage.textContent = '';
   }

   /**
    * Reset props to defaults (if defined in static props).
    * @returns {void}
    */
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

   /**
    * Show reset feedback in button.
    * @param {number} resetCount
    * @returns {void}
    */
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

   /**
    * Render info tab content.
    * @returns {void}
    */
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

   /**
    * Get a simple value type label.
    * @param {any} value
    * @returns {string}
    */
   getValueType(value) {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (Array.isArray(value)) return 'array';
      return typeof value;
   }

   /**
    * Serialize a value for input display.
    * @param {any} value
    * @returns {string}
    */
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

   /**
    * Resolve which props to show in the debugger.
    * @param {HTMLElement} component
    * @returns {string[]}
    */
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

   /**
    * Detect props from backing fields on the component.
    * @param {HTMLElement} component
    * @returns {string[]}
    */
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

   /**
    * Hide the debugger UI.
    * @returns {void}
    */
   hide() {
      this.debuggerContainer.classList.remove('active');
      this.closeModal();
   }
}

customElements.define('slice-debugger', Debugger);

function productionOnlyCSS(){
return `
/* ============================================================
   Slice Instruments — Component Inspector
   All selectors are scoped under the <slice-debugger> tag so the
   panel never clashes with (or leaks into) app styles. Tokens live
   on the tag so both #debugger-container and the sibling
   #editor-modal inherit them. Every --si-* token reads the matching
   framework theme variable from :root, falling back to the original
   hardcoded value if absent — so debuggers always match the app theme.
   ============================================================ */
slice-debugger {
    --si-accent: var(--primary-color, #6ee7ff);
    --si-accent-rgb: var(--primary-color-rgb, 110, 231, 255);
    --si-surface: var(--primary-background-color, rgba(17, 19, 28, 0.88));
    --si-raised: var(--secondary-background-color, rgba(255, 255, 255, 0.035));
    --si-raised-2: var(--tertiary-background-color, rgba(255, 255, 255, 0.06));
    --si-inset: var(--primary-color-shade, rgba(0, 0, 0, 0.28));
    --si-border: var(--medium-color, rgba(255, 255, 255, 0.09));
    --si-text: var(--font-primary-color, #e8eaf2);
    --si-dim: var(--font-secondary-color, #888fa6);
    --si-danger: var(--danger-color, #ff6b6b);
    --si-success: var(--success-color, #46d39a);
    --si-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace;
    --si-sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
 }

slice-debugger *,
slice-debugger *::before,
slice-debugger *::after { box-sizing: border-box; }

slice-debugger #debugger-container {
   font-family: var(--si-sans);
   display: none;
   position: fixed;
   top: 20px;
   right: 20px;
   width: 430px;
   height: 85vh;
   max-height: 85vh;
   background: var(--si-surface);
   border: 1px solid var(--si-border);
   border-radius: 16px;
   box-shadow:
      0 30px 70px -16px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 0 46px -20px rgba(var(--si-accent-rgb), 0.6);
   color: var(--si-text);
   z-index: 10000;
   overflow: hidden;
   -webkit-backdrop-filter: blur(24px) saturate(1.3);
   backdrop-filter: blur(24px) saturate(1.3);
}

slice-debugger #debugger-container.active {
   display: flex;
   flex-direction: column;
   animation: si-inspector-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes si-inspector-in {
   from { opacity: 0; transform: translateY(12px) scale(0.985); }
   to   { opacity: 1; transform: translateY(0) scale(1); }
}

slice-debugger #debugger-container::before {
   content: '';
   position: absolute;
   left: 0; top: 0; bottom: 0;
   width: 2px;
   background: linear-gradient(180deg, var(--si-accent), transparent 60%);
   opacity: 0.9;
   pointer-events: none;
   z-index: 2;
}

slice-debugger .debugger-header {
   background:
      radial-gradient(140% 160% at 0% 0%, rgba(var(--si-accent-rgb), 0.14), transparent 55%),
      var(--si-raised);
   color: var(--si-text);
   padding: 13px 15px;
   border-bottom: 1px solid var(--si-border);
   user-select: none;
   cursor: grab;
}
slice-debugger .debugger-header:active { cursor: grabbing; }

slice-debugger .header-content {
   display: flex;
   justify-content: space-between;
   align-items: center;
}

slice-debugger .component-info {
   display: flex;
   align-items: center;
   gap: 11px;
   min-width: 0;
}

slice-debugger .component-icon {
   font-size: 17px;
   width: 30px; height: 30px;
   display: flex; align-items: center; justify-content: center;
   border-radius: 9px;
   background: rgba(var(--si-accent-rgb), 0.12);
   border: 1px solid rgba(var(--si-accent-rgb), 0.28);
   color: var(--si-accent);
   flex-shrink: 0;
}

slice-debugger .component-name {
   font-size: 13px;
   font-weight: 600;
   font-family: var(--si-mono);
   color: var(--si-text);
   margin-bottom: 2px;
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

slice-debugger .component-id {
   font-size: 10.5px;
   font-family: var(--si-mono);
   color: var(--si-dim);
   letter-spacing: 0.02em;
}

slice-debugger .header-actions { display: flex; gap: 6px; }

slice-debugger .minimize-btn,
slice-debugger #close-debugger {
   background: var(--si-raised);
   border: 1px solid var(--si-border);
   color: var(--si-dim);
   width: 28px;
   height: 28px;
   border-radius: 8px;
   cursor: pointer;
   display: flex;
   align-items: center;
   justify-content: center;
   font-size: 15px;
   font-weight: 500;
   line-height: 1;
   transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
slice-debugger .minimize-btn:hover,
slice-debugger #close-debugger:hover {
   color: var(--si-text);
   background: var(--si-raised-2);
   border-color: rgba(var(--si-accent-rgb), 0.5);
}
slice-debugger #close-debugger:hover { color: var(--si-danger); border-color: rgba(255, 107, 107, 0.5); }
slice-debugger .minimize-btn:active,
slice-debugger #close-debugger:active { transform: scale(0.92); }

slice-debugger .debugger-content {
   flex: 1;
   display: flex;
   flex-direction: column;
   overflow: hidden;
}

slice-debugger .tabs-container { border-bottom: 1px solid var(--si-border); }

slice-debugger .tab-nav {
   display: flex;
   background: var(--si-inset);
   padding: 0 6px;
   gap: 2px;
}

slice-debugger .tab-btn {
   flex: 1;
   padding: 11px 14px;
   border: none;
   background: transparent;
   color: var(--si-dim);
   font-family: var(--si-mono);
   font-size: 11px;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   cursor: pointer;
   transition: color 0.18s ease, border-color 0.18s ease;
   border-bottom: 2px solid transparent;
}
slice-debugger .tab-btn:hover { color: var(--si-text); }
slice-debugger .tab-btn.active {
   color: var(--si-accent);
   border-bottom-color: var(--si-accent);
}

slice-debugger .tab-content {
   flex: 1;
   overflow: hidden;
   height: calc(85vh - 104px);
}

slice-debugger .tab-pane {
   display: none;
   height: 100%;
   overflow-y: auto;
   overflow-x: hidden;
   padding: 16px;
}
slice-debugger .tab-pane.active { display: block; }

slice-debugger .tab-pane::-webkit-scrollbar { width: 8px; }
slice-debugger .tab-pane::-webkit-scrollbar-track { background: transparent; }
slice-debugger .tab-pane::-webkit-scrollbar-thumb {
   background: var(--si-raised-2);
   border-radius: 8px;
   border: 2px solid transparent;
   background-clip: padding-box;
}
slice-debugger .tab-pane::-webkit-scrollbar-thumb:hover { background: rgba(var(--si-accent-rgb), 0.4); background-clip: padding-box; }

slice-debugger .props-container {
   display: flex;
   flex-direction: column;
   gap: 12px;
   margin-bottom: 16px;
}

slice-debugger .props-actions {
   border-top: 1px solid var(--si-border);
   padding-top: 16px;
   margin-top: 8px;
}

slice-debugger .actions-note {
   margin-top: 12px;
   padding: 9px 12px;
   background: var(--si-raised);
   border-radius: 8px;
   border: 1px solid var(--si-border);
}
slice-debugger .actions-note small {
   color: var(--si-dim);
   font-size: 11px;
   display: flex;
   align-items: center;
   gap: 6px;
}

slice-debugger .props-section {
   background: var(--si-raised);
   border: 1px solid var(--si-border);
   border-radius: 12px;
   padding: 13px;
}

slice-debugger .section-title {
   font-size: 10.5px;
   font-weight: 600;
   letter-spacing: 0.1em;
   text-transform: uppercase;
   color: var(--si-dim);
   margin-bottom: 12px;
   display: flex;
   align-items: center;
   gap: 6px;
}

slice-debugger .prop-item {
   display: flex;
   flex-direction: column;
   gap: 6px;
   padding: 12px;
   background: var(--si-inset);
   border: 1px solid var(--si-border);
   border-left: 2px solid transparent;
   border-radius: 10px;
   margin-bottom: 8px;
   transition: border-color 0.18s ease, background 0.18s ease;
}
slice-debugger .prop-item:hover {
   border-left-color: var(--si-accent);
   background: rgba(0, 0, 0, 0.34);
}

slice-debugger .prop-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   gap: 8px;
}

slice-debugger .prop-name {
   font-size: 12.5px;
   font-weight: 600;
   font-family: var(--si-mono);
   color: var(--si-text);
}
slice-debugger .prop-name.required::after {
   content: " *";
   color: var(--si-danger);
}

slice-debugger .prop-meta {
   display: flex;
   align-items: center;
   gap: 8px;
}

slice-debugger .prop-type {
   font-size: 10px;
   padding: 2px 7px;
   background: rgba(var(--si-accent-rgb), 0.12);
   color: var(--si-accent);
   border: 1px solid rgba(var(--si-accent-rgb), 0.28);
   border-radius: 999px;
   font-family: var(--si-mono);
   font-weight: 500;
   letter-spacing: 0.02em;
}

slice-debugger .prop-status { font-size: 14px; line-height: 1; }
slice-debugger .status-used { color: var(--si-success); }
slice-debugger .status-missing { color: var(--si-danger); }
slice-debugger .status-optional { color: var(--si-dim); }

slice-debugger .prop-input { margin-top: 6px; }
slice-debugger .input-group { position: relative; }

slice-debugger .prop-control {
   width: 100%;
   padding: 9px 34px 9px 11px;
   border: 1px solid var(--si-border);
   border-radius: 8px;
   background: rgba(0, 0, 0, 0.35);
   color: var(--si-text);
   font-size: 12.5px;
   font-family: var(--si-mono);
   transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
slice-debugger .prop-control::placeholder { color: var(--si-dim); }
slice-debugger .prop-control:focus {
   outline: none;
   border-color: rgba(var(--si-accent-rgb), 0.6);
   box-shadow: 0 0 0 3px rgba(var(--si-accent-rgb), 0.13);
}
slice-debugger .prop-control:disabled { opacity: 0.5; cursor: not-allowed; }
slice-debugger .prop-control[readonly] { background: var(--si-raised); cursor: pointer; }
slice-debugger .prop-control[readonly]:focus { border-color: rgba(var(--si-accent-rgb), 0.6); }
slice-debugger .prop-control[type="checkbox"] {
   width: 18px;
   height: 18px;
   padding: 0;
   margin: 0;
   cursor: pointer;
   accent-color: var(--si-accent);
}

slice-debugger .edit-btn {
   position: absolute;
   right: 5px;
   top: 50%;
   transform: translateY(-50%);
   background: rgba(var(--si-accent-rgb), 0.14);
   border: 1px solid rgba(var(--si-accent-rgb), 0.3);
   color: var(--si-accent);
   width: 25px;
   height: 25px;
   border-radius: 6px;
   cursor: pointer;
   font-size: 12px;
   display: flex;
   align-items: center;
   justify-content: center;
   transition: background 0.15s ease, transform 0.15s ease;
}
slice-debugger .edit-btn:hover { background: rgba(var(--si-accent-rgb), 0.26); }
slice-debugger .edit-btn:active { transform: translateY(-50%) scale(0.9); }

slice-debugger .default-value {
   font-size: 10.5px;
   color: var(--si-dim);
   font-family: var(--si-mono);
   margin-top: 2px;
}

slice-debugger .info-list { display: flex; flex-direction: column; gap: 8px; }

slice-debugger .info-item {
   display: flex;
   justify-content: space-between;
   align-items: center;
   gap: 12px;
   padding: 12px 13px;
   background: var(--si-raised);
   border-radius: 10px;
   border: 1px solid var(--si-border);
}

slice-debugger .info-label {
   font-weight: 500;
   color: var(--si-dim);
   font-size: 11px;
   letter-spacing: 0.04em;
   text-transform: uppercase;
}

slice-debugger .info-value {
   color: var(--si-text);
   font-family: var(--si-mono);
   font-size: 12px;
   text-align: right;
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

slice-debugger .actions-container { display: flex; flex-direction: column; gap: 16px; }
slice-debugger .action-buttons { display: flex; flex-direction: column; gap: 8px; }

slice-debugger .action-btn {
   padding: 12px 16px;
   border: 1px solid transparent;
   border-radius: 9px;
   font-size: 12.5px;
   font-weight: 600;
   cursor: pointer;
   transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
   display: flex;
   align-items: center;
   justify-content: center;
   gap: 8px;
}
slice-debugger .action-btn:active { transform: scale(0.99); }
slice-debugger .action-btn.primary { background: var(--si-accent); color: #0b1020; }
slice-debugger .action-btn.primary:hover { filter: brightness(1.08); }
slice-debugger .action-btn.secondary {
   background: rgba(var(--si-accent-rgb), 0.12);
   color: var(--si-accent);
   border-color: rgba(var(--si-accent-rgb), 0.3);
}
slice-debugger .action-btn.secondary:hover { background: rgba(var(--si-accent-rgb), 0.2); }
slice-debugger .action-btn.tertiary {
   background: var(--si-raised);
   color: var(--si-text);
   border-color: var(--si-border);
}
slice-debugger .action-btn.tertiary:hover { background: var(--si-raised-2); }

slice-debugger .editor-modal {
   display: none;
   position: fixed;
   top: 0;
   left: 0;
   width: 100%;
   height: 100%;
   background: rgba(6, 8, 14, 0.62);
   z-index: 20000;
   -webkit-backdrop-filter: blur(6px);
   backdrop-filter: blur(6px);
}
slice-debugger .editor-modal.active {
   display: flex;
   align-items: center;
   justify-content: center;
   animation: si-inspector-in 0.2s ease;
}

slice-debugger .modal-content {
   background: var(--si-surface);
   border-radius: 16px;
   width: 90%;
   max-width: 620px;
   max-height: 80%;
   display: flex;
   flex-direction: column;
   box-shadow: 0 30px 70px -16px rgba(0, 0, 0, 0.7);
   border: 1px solid var(--si-border);
   -webkit-backdrop-filter: blur(24px);
   backdrop-filter: blur(24px);
}

slice-debugger .modal-header {
   padding: 15px 20px;
   background: var(--si-raised);
   border-radius: 16px 16px 0 0;
   border-bottom: 1px solid var(--si-border);
   display: flex;
   justify-content: space-between;
   align-items: center;
}
slice-debugger .modal-header h3 {
   margin: 0;
   font-size: 13px;
   font-weight: 600;
   font-family: var(--si-mono);
   letter-spacing: 0.04em;
   color: var(--si-text);
}

slice-debugger .modal-close {
   background: var(--si-raised);
   border: 1px solid var(--si-border);
   font-size: 16px;
   color: var(--si-dim);
   cursor: pointer;
   width: 30px;
   height: 30px;
   border-radius: 8px;
   display: flex;
   align-items: center;
   justify-content: center;
   transition: color 0.15s ease, background 0.15s ease;
}
slice-debugger .modal-close:hover { color: var(--si-danger); background: var(--si-raised-2); }

slice-debugger .modal-body {
   flex: 1;
   padding: 20px;
   display: flex;
   flex-direction: column;
   gap: 16px;
   overflow: hidden;
}

slice-debugger .editor-type-selector {
   display: flex;
   gap: 4px;
   background: var(--si-inset);
   padding: 4px;
   border-radius: 9px;
   border: 1px solid var(--si-border);
}

slice-debugger .type-btn {
   flex: 1;
   padding: 8px 12px;
   border: none;
   background: transparent;
   color: var(--si-dim);
   font-size: 11px;
   font-family: var(--si-mono);
   font-weight: 500;
   cursor: pointer;
   border-radius: 6px;
   transition: color 0.15s ease, background 0.15s ease;
}
slice-debugger .type-btn.active {
   background: rgba(var(--si-accent-rgb), 0.16);
   color: var(--si-accent);
}

slice-debugger .editor-container {
   flex: 1;
   position: relative;
   min-height: 200px;
}

slice-debugger #property-editor {
   width: 100%;
   height: 100%;
   border: 1px solid var(--si-border);
   border-radius: 10px;
   padding: 14px;
   background: rgba(0, 0, 0, 0.4);
   color: var(--si-text);
   font-family: var(--si-mono);
   font-size: 12.5px;
   line-height: 1.6;
   resize: none;
   outline: none;
   min-height: 200px;
   tab-size: 2;
}
slice-debugger #property-editor:focus {
   border-color: rgba(var(--si-accent-rgb), 0.6);
   box-shadow: 0 0 0 3px rgba(var(--si-accent-rgb), 0.13);
}

slice-debugger .validation-message {
   font-size: 11.5px;
   color: var(--si-danger);
   min-height: 18px;
   display: flex;
   align-items: center;
   gap: 6px;
   font-family: var(--si-mono);
}

slice-debugger .modal-actions {
   padding: 15px 20px;
   background: var(--si-raised);
   border-radius: 0 0 16px 16px;
   border-top: 1px solid var(--si-border);
   display: flex;
   gap: 12px;
   justify-content: flex-end;
}

slice-debugger .modal-btn {
   padding: 10px 20px;
   border: 1px solid transparent;
   border-radius: 8px;
   font-size: 12.5px;
   font-weight: 600;
   cursor: pointer;
   transition: background 0.15s ease, border-color 0.15s ease;
}
slice-debugger .modal-btn.cancel {
   background: var(--si-raised);
   color: var(--si-text);
   border-color: var(--si-border);
}
slice-debugger .modal-btn.cancel:hover { background: var(--si-raised-2); }
slice-debugger .modal-btn.save { background: var(--si-success); color: #06231a; }
slice-debugger .modal-btn.save:hover { filter: brightness(1.08); }
slice-debugger .modal-btn.save:disabled { opacity: 0.45; cursor: not-allowed; filter: none; }

@media (prefers-reduced-motion: reduce) {
   slice-debugger #debugger-container.active,
   slice-debugger .editor-modal.active { animation: none; }
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