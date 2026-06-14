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
      this.container = this.querySelector('#context-debugger');
      this.header = this.querySelector('.context-header');
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
              let preview;
              try { preview = JSON.stringify(item.state, null, 2); } catch { preview = String(item.state); }
              return `
               <div class="context-row">
                  <div class="context-row-head">
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
            <div class="brand">
               <span class="status-dot"></span>
               <span class="glyph">◈</span>
               <span class="title">CONTEXT</span>
            </div>
            <div class="actions">
               <button id="context-refresh" class="btn" title="Refresh" aria-label="Refresh">⟳</button>
               <button id="context-close" class="btn" title="Close" aria-label="Close">✕</button>
            </div>
         </div>
         <div class="context-toolbar">
            <input id="context-filter" type="text" placeholder="filter contexts…" autocomplete="off" spellcheck="false" />
            <div class="count"><span id="context-count">0</span></div>
         </div>
         <div class="context-list" id="context-list"></div>
      </div>
      `;
   }

   renderStyles() {
      return `
/* Slice Instruments — context store. All selectors scoped to the
   <slice-contextmanager-debugger> tag so nothing clashes with app styles. */
slice-contextmanager-debugger {
   --si-accent: var(--primary-color, #6ee7ff);
   --si-accent-rgb: var(--primary-color-rgb, 110, 231, 255);
   --si-surface: rgba(17, 19, 28, 0.86);
   --si-raised: rgba(255, 255, 255, 0.035);
   --si-raised-2: rgba(255, 255, 255, 0.06);
   --si-border: rgba(255, 255, 255, 0.09);
   --si-text: #e8eaf2;
   --si-dim: #888fa6;
   --si-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace;
}

slice-contextmanager-debugger #context-debugger {
   position: fixed;
   bottom: 20px;
   left: 20px;
   width: min(400px, calc(100vw - 40px));
   max-height: 64vh;
   background: var(--si-surface);
   border: 1px solid var(--si-border);
   border-radius: 14px;
   box-shadow:
      0 24px 60px -12px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 0 38px -18px rgba(var(--si-accent-rgb), 0.55);
   -webkit-backdrop-filter: blur(22px) saturate(1.3);
   backdrop-filter: blur(22px) saturate(1.3);
   display: none;
   flex-direction: column;
   z-index: 10001;
   overflow: hidden;
   color: var(--si-text);
   font-family: var(--si-mono);
}

slice-contextmanager-debugger #context-debugger.active {
   display: flex;
   animation: si-context-in 0.26s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes si-context-in {
   from { opacity: 0; transform: translateY(10px) scale(0.985); }
   to   { opacity: 1; transform: translateY(0) scale(1); }
}

slice-contextmanager-debugger #context-debugger * { box-sizing: border-box; }

slice-contextmanager-debugger #context-debugger::before {
   content: '';
   position: absolute;
   left: 0; top: 0; bottom: 0;
   width: 2px;
   background: linear-gradient(180deg, var(--si-accent), transparent 70%);
   opacity: 0.85;
   pointer-events: none;
}

slice-contextmanager-debugger #context-debugger > .context-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   padding: 12px 14px;
   background:
      radial-gradient(120% 140% at 0% 0%, rgba(var(--si-accent-rgb), 0.10), transparent 60%),
      var(--si-raised);
   border-bottom: 1px solid var(--si-border);
   user-select: none;
}

slice-contextmanager-debugger .brand { display: flex; align-items: center; gap: 9px; }

slice-contextmanager-debugger .status-dot {
   width: 7px; height: 7px;
   border-radius: 50%;
   background: var(--si-accent);
   animation: si-pulse-ctx 2.4s ease-out infinite;
}

@keyframes si-pulse-ctx {
   0%   { box-shadow: 0 0 0 0 rgba(var(--si-accent-rgb), 0.55); }
   70%  { box-shadow: 0 0 0 7px rgba(var(--si-accent-rgb), 0); }
   100% { box-shadow: 0 0 0 0 rgba(var(--si-accent-rgb), 0); }
}

slice-contextmanager-debugger .glyph { color: var(--si-accent); font-size: 12px; opacity: 0.9; }

slice-contextmanager-debugger .title {
   font-weight: 600;
   font-size: 11px;
   letter-spacing: 0.18em;
   color: var(--si-text);
}

slice-contextmanager-debugger .actions { display: flex; gap: 6px; }

slice-contextmanager-debugger .btn {
   width: 26px; height: 26px;
   display: flex; align-items: center; justify-content: center;
   border-radius: 7px;
   border: 1px solid var(--si-border);
   background: var(--si-raised);
   color: var(--si-dim);
   cursor: pointer;
   font-size: 13px;
   line-height: 1;
   transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
slice-contextmanager-debugger .btn:hover {
   color: var(--si-text);
   background: var(--si-raised-2);
   border-color: rgba(var(--si-accent-rgb), 0.5);
}
slice-contextmanager-debugger .btn:active { transform: scale(0.92); }
slice-contextmanager-debugger #context-refresh:hover { color: var(--si-accent); }

slice-contextmanager-debugger .context-toolbar {
   display: flex;
   gap: 10px;
   align-items: center;
   padding: 10px 12px;
   border-bottom: 1px solid var(--si-border);
}

slice-contextmanager-debugger .context-toolbar input {
   flex: 1;
   min-width: 0;
   padding: 7px 10px 7px 30px;
   border-radius: 8px;
   border: 1px solid var(--si-border);
   background:
      var(--si-raised) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%23888fa6' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E") no-repeat 10px center;
   color: var(--si-text);
   font-family: var(--si-mono);
   font-size: 12px;
   transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
slice-contextmanager-debugger .context-toolbar input::placeholder { color: var(--si-dim); }
slice-contextmanager-debugger .context-toolbar input:focus {
   outline: none;
   border-color: rgba(var(--si-accent-rgb), 0.6);
   box-shadow: 0 0 0 3px rgba(var(--si-accent-rgb), 0.12);
}

slice-contextmanager-debugger .context-toolbar .count { font-size: 11px; color: var(--si-dim); min-width: 22px; text-align: center; }
slice-contextmanager-debugger .context-toolbar .count span { color: var(--si-accent); font-weight: 600; }

slice-contextmanager-debugger .context-list {
   padding: 10px 12px 12px;
   overflow: auto;
   display: flex;
   flex-direction: column;
   gap: 9px;
}
slice-contextmanager-debugger .context-list::-webkit-scrollbar { width: 8px; }
slice-contextmanager-debugger .context-list::-webkit-scrollbar-thumb {
   background: var(--si-raised-2);
   border-radius: 8px;
   border: 2px solid transparent;
   background-clip: padding-box;
}
slice-contextmanager-debugger .context-list::-webkit-scrollbar-thumb:hover { background: rgba(var(--si-accent-rgb), 0.4); background-clip: padding-box; }

slice-contextmanager-debugger .context-row {
   border: 1px solid var(--si-border);
   border-left: 2px solid transparent;
   border-radius: 10px;
   background: var(--si-raised);
   padding: 10px 11px;
   display: flex;
   flex-direction: column;
   gap: 8px;
   transition: border-color 0.18s ease, background 0.18s ease;
}
slice-contextmanager-debugger .context-row:hover { background: var(--si-raised-2); border-left-color: var(--si-accent); }

slice-contextmanager-debugger .context-row-head {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 10px;
}

slice-contextmanager-debugger .context-name {
   font-weight: 600;
   font-size: 12.5px;
   color: var(--si-text);
   font-family: var(--si-mono);
}

slice-contextmanager-debugger .context-keys {
   font-size: 10px;
   letter-spacing: 0.04em;
   text-transform: uppercase;
   color: var(--si-accent);
   background: rgba(var(--si-accent-rgb), 0.12);
   border: 1px solid rgba(var(--si-accent-rgb), 0.25);
   padding: 1px 8px;
   border-radius: 999px;
   white-space: nowrap;
}

slice-contextmanager-debugger .context-preview {
   background: rgba(0, 0, 0, 0.3);
   border-radius: 8px;
   padding: 10px;
   border: 1px solid var(--si-border);
   max-height: 200px;
   overflow: auto;
   font-size: 11px;
   line-height: 1.55;
   font-family: var(--si-mono);
   color: #c5cad8;
   white-space: pre;
   margin: 0;
}
slice-contextmanager-debugger .context-preview::-webkit-scrollbar { width: 8px; height: 8px; }
slice-contextmanager-debugger .context-preview::-webkit-scrollbar-thumb {
   background: var(--si-raised-2);
   border-radius: 8px;
   border: 2px solid transparent;
   background-clip: padding-box;
}

slice-contextmanager-debugger .empty {
   color: var(--si-dim);
   font-size: 11px;
   letter-spacing: 0.04em;
   text-align: center;
   padding: 22px 0;
}

@media (prefers-reduced-motion: reduce) {
   slice-contextmanager-debugger #context-debugger.active { animation: none; }
   slice-contextmanager-debugger .status-dot { animation: none; }
}
      `;
   }
}

customElements.define('slice-contextmanager-debugger', ContextManagerDebugger);
