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
      this.makeDraggable();
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
      this.header = this.querySelector('.events-header');
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

   makeDraggable() {
      if (!this.header || !this.container) return;

      let offset = { x: 0, y: 0 };
      let isDragging = false;

      this.header.style.cursor = 'grab';

      this.header.addEventListener('mousedown', (event) => {
         if (event.target.closest('.btn')) return;
         isDragging = true;
         offset.x = event.clientX - this.container.getBoundingClientRect().left;
         offset.y = event.clientY - this.container.getBoundingClientRect().top;
         this.header.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', (event) => {
         if (!isDragging) return;
         const rect = this.container.getBoundingClientRect();
         const maxX = window.innerWidth - rect.width;
         const maxY = window.innerHeight - rect.height;
         const x = Math.min(Math.max(event.clientX - offset.x, 0), maxX);
         const y = Math.min(Math.max(event.clientY - offset.y, 0), maxY);
         this.container.style.left = `${x}px`;
         this.container.style.top = `${y}px`;
         this.container.style.right = 'auto';
         this.container.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
         if (!isDragging) return;
         isDragging = false;
         this.header.style.cursor = 'grab';
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
         const entries = Array.from(subs.entries()).map(([id, sub]) => {
            const componentSliceId = sub.componentSliceId || null;
            const component = componentSliceId ? slice.controller.getComponent(componentSliceId) : null;
            const componentName = component?.constructor?.name || null;
            return {
               id,
               once: sub.once,
               componentSliceId,
               componentName
            };
         });

         if (this.filterText && !eventName.toLowerCase().includes(this.filterText)) {
            return;
         }

         items.push({ eventName, count: subs.size, entries });
      });

      items.sort((a, b) => a.eventName.localeCompare(b.eventName));

      this.countLabel.textContent = String(items.length);
      this.list.innerHTML = items.length
         ? items.map((item) => {
              const details = item.entries.map((entry) => {
                 const label = entry.componentName
                    ? `${entry.componentName} (${entry.componentSliceId})`
                    : entry.componentSliceId || 'Global';
                 const onceBadge = entry.once ? '<span class="badge">once</span>' : '';
                 return `
                  <div class="subscriber-row">
                     <div class="subscriber-name">${label}</div>
                     <div class="subscriber-meta">${entry.id}${onceBadge}</div>
                  </div>
               `;
              }).join('');

              return `
               <details class="event-row">
                  <summary>
                     <div class="event-name">${item.eventName}</div>
                     <div class="event-count">${item.count}</div>
                  </summary>
                  <div class="subscriber-list">
                     ${details || '<div class="empty">No subscribers</div>'}
                  </div>
               </details>
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
         user-select: none;
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
         display: block;
         padding: 8px 10px;
         background: var(--tertiary-background-color);
         border-radius: 6px;
         border: 1px solid var(--medium-color);
      }

      .event-row summary {
         display: flex;
         align-items: center;
         justify-content: space-between;
         gap: 8px;
         cursor: pointer;
         list-style: none;
      }

      .event-row summary::-webkit-details-marker {
         display: none;
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

      .subscriber-list {
         margin-top: 10px;
         display: flex;
         flex-direction: column;
         gap: 8px;
      }

      .subscriber-row {
         display: flex;
         justify-content: space-between;
         gap: 8px;
         padding: 6px 8px;
         border-radius: 6px;
         background: var(--primary-background-color);
         border: 1px solid var(--medium-color);
      }

      .subscriber-name {
         font-size: 12px;
         color: var(--font-primary-color);
         overflow: hidden;
         text-overflow: ellipsis;
         white-space: nowrap;
      }

      .subscriber-meta {
         font-size: 11px;
         color: var(--font-secondary-color);
         display: flex;
         align-items: center;
         gap: 6px;
         white-space: nowrap;
      }

      .badge {
         padding: 2px 6px;
         border-radius: 999px;
         background: var(--secondary-color);
         color: var(--secondary-color-contrast);
         font-size: 10px;
         text-transform: uppercase;
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
