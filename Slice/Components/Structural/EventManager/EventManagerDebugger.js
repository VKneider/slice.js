/**
 * EventManager debug panel.
 */
export default class EventManagerDebugger extends HTMLElement {
   constructor() {
      super();
      this.isOpen = false;
      this.filterText = '';
      this.refreshInterval = null;
   }

   /**
    * Initialize panel UI.
    * @returns {Promise<void>}
    */
   async init() {
      this.innerHTML = this.renderTemplate();
      slice.stylesManager.registerComponentStyles('EventManagerDebugger', this.renderStyles());
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
      this.container = this.querySelector('#events-debugger');
      this.list = this.querySelector('#events-list');
      this.filterInput = this.querySelector('#events-filter');
      this.countLabel = this.querySelector('#events-count');
      this.refreshButton = this.querySelector('#events-refresh');
      this.closeButton = this.querySelector('#events-close');
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
      if (!slice?.events?.subscriptions) {
         this.list.textContent = 'EventManager not available.';
         this.countLabel.textContent = '0';
         return;
      }

      const items = [];
      slice.events.subscriptions.forEach((subs, eventName) => {
         const count = subs.size;
         if (this.filterText && !eventName.toLowerCase().includes(this.filterText)) {
            return;
         }
         items.push({ eventName, count });
      });

      items.sort((a, b) => a.eventName.localeCompare(b.eventName));

      this.countLabel.textContent = String(items.length);
      this.list.innerHTML = items.length
         ? items.map((item) => {
              return `
               <div class="event-row">
                  <div class="event-name">${item.eventName}</div>
                  <div class="event-count">${item.count}</div>
               </div>
            `;
           }).join('')
         : '<div class="empty">No events</div>';
   }

   renderTemplate() {
      return `
      <div id="events-debugger">
         <div class="events-header">
            <div class="title">Events</div>
            <div class="actions">
               <button id="events-refresh" class="btn">Refresh</button>
               <button id="events-close" class="btn">Close</button>
            </div>
         </div>
         <div class="events-toolbar">
            <input id="events-filter" type="text" placeholder="Filter events" />
            <div class="count">Total: <span id="events-count">0</span></div>
         </div>
         <div class="events-list" id="events-list"></div>
      </div>
      `;
   }

   renderStyles() {
      return `
      #events-debugger {
         position: fixed;
         bottom: 20px;
         right: 20px;
         width: min(360px, calc(100vw - 40px));
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

      #events-debugger.active {
         display: flex;
      }

      #events-debugger * {
         box-sizing: border-box;
      }

      .events-header {
         display: flex;
         justify-content: space-between;
         align-items: center;
         padding: 12px 14px;
         background: var(--tertiary-background-color);
         border-bottom: 1px solid var(--medium-color);
      }

      .events-header .title {
         font-weight: 600;
         color: var(--font-primary-color);
      }

      .events-header .actions {
         display: flex;
         gap: 8px;
      }

      .events-header .btn {
         padding: 6px 10px;
         border-radius: 6px;
         border: 1px solid var(--medium-color);
         background: var(--primary-background-color);
         color: var(--font-primary-color);
         cursor: pointer;
         font-size: 12px;
      }

      .events-toolbar {
         display: flex;
         gap: 10px;
         align-items: center;
         padding: 10px 12px;
         border-bottom: 1px solid var(--medium-color);
      }

      .events-toolbar input {
         flex: 1;
         min-width: 0;
         padding: 6px 8px;
         border-radius: 6px;
         border: 1px solid var(--medium-color);
         background: var(--primary-background-color);
         color: var(--font-primary-color);
      }

      .events-list {
         padding: 10px 12px;
         overflow: auto;
         display: flex;
         flex-direction: column;
         gap: 8px;
      }

      .event-row {
         display: flex;
         justify-content: space-between;
         padding: 8px 10px;
         background: var(--tertiary-background-color);
         border-radius: 6px;
         border: 1px solid var(--medium-color);
         gap: 8px;
      }

      .event-name {
         font-family: monospace;
         font-size: 12px;
         color: var(--font-primary-color);
         overflow: hidden;
         text-overflow: ellipsis;
         white-space: nowrap;
      }

      .event-count {
         font-weight: 600;
         color: var(--primary-color);
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

customElements.define('slice-eventmanager-debugger', EventManagerDebugger);
