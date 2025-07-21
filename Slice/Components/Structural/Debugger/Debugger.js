export default class Debugger extends HTMLElement {
   constructor() {
      super();
      this.toggleClick = slice.debuggerConfig.click;
      this.toggle = 'click';
      this.selectedComponentSliceId = null;
      this.isActive = false;
      this.activeTab = 'props';
   }

   async enableDebugMode() {
      // Cargar HTML y CSS desde archivos externos
      const html = await slice.controller.fetchText('Debugger', 'html', 'Structural');
      const css = await slice.controller.fetchText('Debugger', 'css', 'Structural');

      this.innerHTML = html;
      slice.stylesManager.registerComponentStyles('Debugger', css);

      this.setupElements();
      this.setupEventListeners();
      this.makeDraggable();

      slice.logger.logInfo('Logger', 'Advanced Debug mode enabled');
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
      this.querySelector('#apply-changes').addEventListener('click', () => {
         this.applyAllChanges();
      });

      this.querySelector('#reset-values').addEventListener('click', () => {
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

      // ✅ SIMPLIFICADO: Solo Enter para aplicar, sin más eventos automáticos
      this.addEventListener('keypress', (event) => {
         if (event.key === 'Enter' && event.target.classList.contains('prop-control')) {
            event.preventDefault();
            this.applyPropertyChange(event.target);
         }
      });

      // ✅ SIMPLIFICADO: Solo cambio visual para checkboxes
      this.addEventListener('change', (event) => {
         if (event.target.type === 'checkbox' && event.target.classList.contains('prop-control')) {
            const span = event.target.nextElementSibling;
            if (span) {
               span.textContent = event.target.checked ? 'true' : 'false';
            }
            this.applyPropertyChange(event.target);
         }
      });

      // ✅ DEBUG: Agregar logs para entender qué está pasando
      this.addEventListener('click', (event) => {
         if (event.target.classList.contains('prop-control')) {
            console.log('🎯 Debug: Input clicked', event.target.dataset.prop);
         }
      });

      this.addEventListener('focus', (event) => {
         if (event.target.classList.contains('prop-control')) {
            console.log('🎯 Debug: Input focused', event.target.dataset.prop);
         }
      }, true);

      this.addEventListener('blur', (event) => {
         if (event.target.classList.contains('prop-control')) {
            console.log('🎯 Debug: Input blurred', event.target.dataset.prop);
         }
      }, true);
   }

   switchTab(tabName) {
      this.activeTab = tabName;
      
      // Update tab buttons
      this.querySelectorAll('.tab-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      // Update tab panes
      this.querySelectorAll('.tab-pane').forEach(pane => {
         pane.classList.toggle('active', pane.id === `${tabName}-tab`);
      });
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

      this.updateDebuggerContent();
      this.debuggerContainer.classList.add('active');
   }

   updateDebuggerContent() {
      console.log('🔥 DEBUG: updateDebuggerContent called - this recreates ALL inputs!');
      console.trace(); // Esto nos dirá desde dónde se está llamando
      this.updatePropsTab();
      this.updateInfoTab();
   }

   updatePropsTab() {
      console.log('🔥 DEBUG: updatePropsTab called - this recreates props inputs!');
      console.trace();
      
      const component = this.currentComponent;
      const ComponentClass = component.constructor;
      const hasStaticProps = ComponentClass.props && !slice.isProduction();
      const staticProps = ComponentClass.props || {};

      this.propsContainer.innerHTML = '';

      if (hasStaticProps) {
         // Enhanced props view
         const usedSection = document.createElement('div');
         usedSection.className = 'props-section';
         usedSection.innerHTML = '<div class="section-title">📋 Component Properties</div>';

         Object.entries(staticProps).forEach(([prop, config]) => {
            const propItem = this.createPropItem(prop, config, this.componentProps[prop]);
            usedSection.appendChild(propItem);
         });

         this.propsContainer.appendChild(usedSection);
      } else {
         // Legacy props view
         const legacySection = document.createElement('div');
         legacySection.className = 'props-section';
         legacySection.innerHTML = '<div class="section-title">📋 Properties (Legacy)</div>';

         Object.entries(this.componentProps).forEach(([prop, value]) => {
            if (value !== null) {
               const propItem = this.createLegacyPropItem(prop, value);
               legacySection.appendChild(propItem);
            }
         });

         this.propsContainer.appendChild(legacySection);
      }
   }

   createPropItem(prop, config, value) {
      const isUsed = value !== undefined;
      const isRequired = config.required;
      
      const propItem = document.createElement('div');
      propItem.className = 'prop-item';

      const statusClass = isRequired && !isUsed ? 'status-missing' : 
                         isUsed ? 'status-used' : 'status-optional';
      const statusText = isRequired && !isUsed ? '❌ Missing' : 
                        isUsed ? '✅ Used' : '⚪ Optional';

      const inputType = this.getInputType(config.type, value);
      const inputHtml = this.createPropertyInput(prop, value, config, inputType);

      propItem.innerHTML = `
         <div class="prop-header">
            <div class="prop-name ${isRequired ? 'required' : ''}">${prop}</div>
            <div class="prop-meta">
               <span class="prop-type">${config.type || 'any'}</span>
               <span class="prop-status ${statusClass}">${statusText}</span>
            </div>
         </div>
         <div class="prop-input">${inputHtml}</div>
         ${!isUsed && config.default !== undefined ? 
           `<div class="default-value">Default: ${JSON.stringify(config.default)}</div>` : ''}
      `;

      return propItem;
   }

   createLegacyPropItem(prop, value) {
      const propItem = document.createElement('div');
      propItem.className = 'prop-item';

      const inputType = this.getInputType(typeof value, value);
      const inputHtml = this.createPropertyInput(prop, value, null, inputType);

      propItem.innerHTML = `
         <div class="prop-header">
            <div class="prop-name">${prop}</div>
            <div class="prop-meta">
               <span class="prop-type">${typeof value}</span>
               <span class="prop-status status-used">✅ Used</span>
            </div>
         </div>
         <div class="prop-input">${inputHtml}</div>
      `;

      return propItem;
   }

   getInputType(type, value) {
      if (typeof value === 'object' || type === 'object') return 'object';
      if (typeof value === 'function' || type === 'function') return 'function';
      if (typeof value === 'boolean' || type === 'boolean') return 'boolean';
      if (typeof value === 'number' || type === 'number') return 'number';
      return 'text';
   }

   createPropertyInput(prop, value, config, inputType) {
      const hasComplexEditor = inputType === 'object' || inputType === 'function';
      const displayValue = this.formatValueForDisplay(value);
      
      if (hasComplexEditor) {
         return `
            <div class="input-group">
               <input type="text" class="prop-control" 
                      value="${displayValue}" 
                      data-prop="${prop}" 
                      readonly>
               <button class="edit-btn" onclick="slice.debugger.openEditor('${prop}', '${inputType}')">✏️</button>
            </div>
         `;
      } else if (inputType === 'boolean') {
         const checked = value ? 'checked' : '';
         return `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
               <input type="checkbox" ${checked} data-prop="${prop}" class="prop-control">
               <span style="font-size: 13px; color: var(--font-secondary-color);">
                  ${value ? 'true' : 'false'}
               </span>
            </label>
         `;
      } else {
         // ✅ CORREGIDO: Inputs normales SIN readonly para permitir edición
         return `
            <input type="${inputType === 'number' ? 'number' : 'text'}" 
                   class="prop-control" 
                   value="${displayValue}" 
                   data-prop="${prop}"
                   placeholder="Enter ${inputType} value...">
         `;
      }
   }

   formatValueForDisplay(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'function') return '[Function]';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
   }

   updateInfoTab() {
      const component = this.currentComponent;
      
      const infoItems = [
         { label: 'Component Name', value: component.constructor.name },
         { label: 'Slice ID', value: component.sliceId },
         { label: 'Connected to DOM', value: component.isConnected ? 'Yes' : 'No' },
         { label: 'Has Static Props', value: component.constructor.props ? 'Yes' : 'No' },
         { label: 'Props Count', value: Object.keys(this.componentProps).length },
         { label: 'Custom Element', value: component.tagName.toLowerCase() }
      ];

      this.infoContainer.innerHTML = infoItems.map(item => `
         <div class="info-item">
            <div class="info-label">${item.label}</div>
            <div class="info-value">${item.value}</div>
         </div>
      `).join('');
   }

   openEditor(prop, type) {
      this.currentEditingProp = prop;
      this.currentEditingType = type;
      
      const value = this.componentProps[prop];
      this.modalTitle.textContent = `Edit ${prop}`;
      
      // Set editor type
      this.querySelectorAll('.type-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.type === type);
      });

      // Set editor content
      if (type === 'function') {
         this.propertyEditor.value = typeof value === 'function' ? 
            value.toString() : 'function() {\n  // Your code here\n}';
      } else {
         this.propertyEditor.value = JSON.stringify(value, null, 2);
      }

      this.editorModal.classList.add('active');
      this.propertyEditor.focus();
      this.validateEditor();
   }

   switchEditorType(type) {
      this.currentEditingType = type;
      
      this.querySelectorAll('.type-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.type === type);
      });

      const value = this.componentProps[this.currentEditingProp];
      
      if (type === 'function') {
         this.propertyEditor.value = typeof value === 'function' ? 
            value.toString() : 'function() {\n  // Your code here\n}';
      } else {
         this.propertyEditor.value = JSON.stringify(value, null, 2);
      }
      
      this.validateEditor();
   }

   validateEditor() {
      const content = this.propertyEditor.value;
      const saveBtn = this.querySelector('#modal-save');
      
      try {
         if (this.currentEditingType === 'function') {
            // Basic function validation
            if (content.trim().startsWith('function') || content.trim().startsWith('(') || content.includes('=>')) {
               new Function('return ' + content);
               this.validationMessage.textContent = '✅ Valid function syntax';
               this.validationMessage.style.color = 'var(--success-color)';
               saveBtn.disabled = false;
            } else {
               throw new Error('Invalid function syntax');
            }
         } else {
            JSON.parse(content);
            this.validationMessage.textContent = '✅ Valid JSON';
            this.validationMessage.style.color = 'var(--success-color)';
            saveBtn.disabled = false;
         }
      } catch (error) {
         this.validationMessage.textContent = `❌ ${error.message}`;
         this.validationMessage.style.color = 'var(--danger-color)';
         saveBtn.disabled = true;
      }
   }

   savePropertyValue() {
      const content = this.propertyEditor.value;
      
      try {
         let newValue;
         
         if (this.currentEditingType === 'function') {
            newValue = new Function('return ' + content)();
         } else {
            newValue = JSON.parse(content);
         }

         // Update component property
         this.currentComponent[this.currentEditingProp] = newValue;
         this.componentProps[this.currentEditingProp] = newValue;
         
         // ✅ CORREGIDO: Solo actualizar UI después de cerrar modal
         this.closeModal();
         
         // ✅ Recrear props solo después de editar objeto/función (necesario)
         setTimeout(() => {
            this.updatePropsTab();
         }, 50);
         
         slice.logger.logInfo('Debugger', `Updated ${this.currentEditingProp} via advanced editor`);
      } catch (error) {
         this.validationMessage.textContent = `❌ ${error.message}`;
         this.validationMessage.style.color = 'var(--danger-color)';
      }
   }

   closeModal() {
      this.editorModal.classList.remove('active');
      this.currentEditingProp = null;
      this.currentEditingType = null;
      this.validationMessage.textContent = '';
   }

   // ✅ NUEVO: Aplicar cambio de una propiedad específica SIN tocar UI
   applyPropertyChange(inputElement) {
      const prop = inputElement.dataset.prop;
      if (!prop) return;

      let newValue;
      
      if (inputElement.type === 'checkbox') {
         newValue = inputElement.checked;
      } else if (inputElement.type === 'number') {
         newValue = Number(inputElement.value);
      } else {
         newValue = inputElement.value;
         
         // Convert string values
         if (newValue === 'true') newValue = true;
         if (newValue === 'false') newValue = false;
         if (!isNaN(newValue) && newValue !== '') newValue = Number(newValue);
      }

      const oldValue = this.currentComponent[prop];
      
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
         this.currentComponent[prop] = newValue;
         slice.logger.logInfo('Debugger', `Updated ${prop}: ${oldValue} → ${newValue}`);
      }
   }

   // ✅ SIMPLIFICADO: Solo para el botón Apply Changes
   applyAllChanges() {
      const inputs = this.propsContainer.querySelectorAll('.prop-control');
      let changesCount = 0;

      inputs.forEach(input => {
         const prop = input.dataset.prop;
         if (!prop) return;

         let newValue;
         
         if (input.type === 'checkbox') {
            newValue = input.checked;
         } else if (input.type === 'number') {
            newValue = Number(input.value);
         } else {
            newValue = input.value;
            
            if (newValue === 'true') newValue = true;
            if (newValue === 'false') newValue = false;
            if (!isNaN(newValue) && newValue !== '') newValue = Number(newValue);
         }

         const oldValue = this.currentComponent[prop];
         
         if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
            this.currentComponent[prop] = newValue;
            changesCount++;
         }
      });

      slice.logger.logInfo('Debugger', `Applied ${changesCount} changes via button`);
      
      if (changesCount > 0) {
         this.showApplyFeedback(changesCount);
      }
   }

   // ✅ NUEVO: Mostrar feedback visual
   showApplyFeedback(changesCount) {
      const applyBtn = this.querySelector('#apply-changes');
      const originalText = applyBtn.textContent;
      
      applyBtn.textContent = `✅ Applied ${changesCount} changes!`;
      applyBtn.style.background = 'var(--success-color)';
      
      setTimeout(() => {
         applyBtn.textContent = originalText;
         applyBtn.style.background = 'var(--primary-color)';
      }, 1500);
   }

   resetValues() {
      const ComponentClass = this.currentComponent.constructor;
      const staticProps = ComponentClass.props || {};
      let resetCount = 0;

      Object.entries(staticProps).forEach(([prop, config]) => {
         if (config.default !== undefined) {
            this.currentComponent[prop] = config.default;
            resetCount++;
         }
      });

      slice.logger.logInfo('Debugger', 'Reset values to defaults');
      
      // ✅ CORREGIDO: Solo recrear UI después del reset (necesario)
      if (resetCount > 0) {
         this.updatePropsTab(); // Necesario para mostrar los nuevos valores
         this.showResetFeedback(resetCount);
      }
   }

   // ✅ NUEVO: Mostrar feedback visual para reset
   showResetFeedback(resetCount) {
      const resetBtn = this.querySelector('#reset-values');
      const originalText = resetBtn.textContent;
      
      resetBtn.textContent = `🔄 Reset ${resetCount} values!`;
      resetBtn.style.background = 'var(--warning-color)';
      
      setTimeout(() => {
         resetBtn.textContent = originalText;
         resetBtn.style.background = 'var(--secondary-color)';
      }, 1500);
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