/**
 * ContextManager debug panel.
 */
export default class ContextManagerDebugger extends HTMLElement {
   constructor() {
      super();
      this.isOpen = false;
      this.filterText = '';
   }

   /**
    * Initialize panel UI.
    * @returns {Promise<void>}
    */
   async init() {
      this.innerHTML = this.renderTemplate();
      slice.stylesManager.registerComponentStyles('ContextManagerDebugger', this.renderStyles());
      this.cacheElements();
      this.bindEvents();
      this.renderList();
   }

   /**
    * Toggle panel visibility.
    * @returns {void}
    */
   toggle() {
      this.isOpen = !this.isOpen;
      this.container.classList.toggle('active', this.isOpen);
      if (this.isOpen) {
         this.renderList();
      }
   }

   /**
    * Show panel.
    * @returns {void}
    */
   open() {
      this.isOpen = true;
      this.container.classList.add('active');
      this.renderList();
   }

   /**
    * Hide panel.
    * @returns {void}
    */
   close() {
      this.isOpen = false;
      this.container.classList.remove('active');
   }

   cacheElements() {
      this.container = this.querySelector('#context-debugger');
      this.list = this.querySelector('#context-list');
      this.filterInput = this.querySelector('#context-filter');
      this.countLabel = this.querySelector('#context-count');
      this.refreshButton = this.querySelector('#context-refresh');
      this.closeButton = this.querySelector('#context-close');
   }

   bindEvents() {
      this.refreshButton.addEventListener('click', () => this.renderList());
      this.closeButton.addEventListener('click', () => this.close());
      this.filterInput.addEventListener('input', (event) => {
         this.filterText = event.target.value.trim().toLowerCase();
         this.renderList();
      });
   }

   renderList() {
      if (!slice?.context?.contexts) {
         this.list.textContent = 'ContextManager not available.';
         this.countLabel.textContent = '0';
         return;
      }

      const items = [];
      slice.context.contexts.forEach((value, name) => {
         if (this.filterText && !name.toLowerCase().includes(this.filterText)) {
            return;
         }
         const keys = value?.state ? Object.keys(value.state).length : 0;
         items.push({ name, keys, state: value?.state || {} });
      });

      items.sort((a, b) => a.name.localeCompare(b.name));

      this.countLabel.textContent = String(items.length);
      this.list.innerHTML = items.length
         ? items.map((item) => {
              const preview = JSON.stringify(item.state, null, 2);
              return `
               <div class="context-row">
                  <div class="context-header">
                     <div class="context-name">${item.name}</div>
                     <div class="context-keys">${item.keys} keys</div>
                  </div>
                  <pre class="context-preview">${this.escapeHtml(preview)}</pre>
               </div>
            `;
           }).join('')
         : '<div class="empty">No contexts</div>';
   }

   escapeHtml(value) {
      return value
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#39;');
   }

   renderTemplate() {
      return `
      <div id="context-debugger">
         <div class="context-header">
            <div class="title">Contexts</div>
            <div class="actions">
               <button id="context-refresh" class="btn">Refresh</button>
               <button id="context-close" class="btn">Close</button>
            </div>
         </div>
         <div class="context-toolbar">
            <input id="context-filter" type="text" placeholder="Filter contexts" />
            <div class="count">Total: <span id="context-count">0</span></div>
         </div>
         <div class="context-list" id="context-list"></div>
      </div>
      `;
   }

   renderStyles() {
      return `
      #context-debugger {
         position: fixed;
         bottom: 20px;
         left: 20px;
         width: min(380px, calc(100vw - 40px));
         max-height: 60vh;
         background: var(--primary-background-color);
         border: 1px solid var(--medium-color);
         border-radius: 12px;
         box-shadow: 0 16px 32px rgba(0, 0, 0, 0.15);
         display: none;
         flex-direction: column;
         z-index: 10001;
         overflow: hidden;
      }

      #context-debugger.active {
         display: flex;
      }

      #context-debugger * {
         box-sizing: border-box;
      }

      .context-header {
         display: flex;
         justify-content: space-between;
         align-items: center;
         padding: 12px 14px;
         background: var(--tertiary-background-color);
         border-bottom: 1px solid var(--medium-color);
      }

      .context-header .title {
         font-weight: 600;
         color: var(--font-primary-color);
      }

      .context-header .actions {
         display: flex;
         gap: 8px;
      }

      .context-header .btn {
         padding: 6px 10px;
         border-radius: 6px;
         border: 1px solid var(--medium-color);
         background: var(--primary-background-color);
         color: var(--font-primary-color);
         cursor: pointer;
         font-size: 12px;
      }

      .context-toolbar {
         display: flex;
         gap: 10px;
         align-items: center;
         padding: 10px 12px;
         border-bottom: 1px solid var(--medium-color);
      }

      .context-toolbar input {
         flex: 1;
         min-width: 0;
         padding: 6px 8px;
         border-radius: 6px;
         border: 1px solid var(--medium-color);
         background: var(--primary-background-color);
         color: var(--font-primary-color);
      }

      .context-list {
         padding: 10px 12px;
         overflow: auto;
         display: flex;
         flex-direction: column;
         gap: 10px;
      }

      .context-row {
         border: 1px solid var(--medium-color);
         border-radius: 8px;
         background: var(--tertiary-background-color);
         padding: 10px;
         display: flex;
         flex-direction: column;
         gap: 6px;
      }

      .context-name {
         font-weight: 600;
         color: var(--font-primary-color);
      }

      .context-keys {
         font-size: 12px;
         color: var(--font-secondary-color);
      }

      .context-preview {
         background: var(--primary-background-color);
         border-radius: 6px;
         padding: 8px;
         border: 1px solid var(--medium-color);
         max-height: 180px;
         overflow: auto;
         font-size: 11px;
         font-family: monospace;
         color: var(--font-primary-color);
      }

      .empty {
         color: var(--font-secondary-color);
         font-size: 12px;
         text-align: center;
         padding: 12px 0;
      }
      `;
   }
}

customElements.define('slice-contextmanager-debugger', ContextManagerDebugger);
