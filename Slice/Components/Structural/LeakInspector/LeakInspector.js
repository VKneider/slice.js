/**
 * LeakInspector — dev-only memory-leak panel.
 *
 * Surfaces components that stay registered in `slice.controller.activeComponents`
 * while detached from the live DOM (built then cleared via innerHTML=''/remove()
 * without destroyComponent). Intentionally-cached components (Route/MultiRoute/
 * Router-managed) are excluded by the Controller's findOrphans() criteria.
 *
 * Mirrors EventManagerDebugger: draggable fixed panel, conditional auto-refresh
 * that only runs while open. Read-only except for the per-orphan Destroy action.
 */
export default class LeakInspector extends HTMLElement {
   constructor() {
      super();
      this.isOpen = false;
      this._autoRefreshTimer = null;
   }

   async init() {
      this.innerHTML = this.renderTemplate();
      slice.stylesManager.registerComponentStyles('LeakInspector', this.renderStyles());
      this.cacheElements();
      this.bindEvents();
      this.makeDraggable();
      this.render();
   }

   toggle() {
      this.isOpen ? this.close() : this.open();
   }

   open() {
      this.isOpen = true;
      this.container.classList.add('active');
      this._startAutoRefresh();
      this.render();
   }

   close() {
      this.isOpen = false;
      this.container.classList.remove('active');
      this._stopAutoRefresh();
   }

   _startAutoRefresh() {
      this._stopAutoRefresh();
      this._autoRefreshTimer = setInterval(() => {
         if (!this.isOpen) return;
         this.render();
      }, 1500);
   }

   _stopAutoRefresh() {
      if (this._autoRefreshTimer) {
         clearInterval(this._autoRefreshTimer);
         this._autoRefreshTimer = null;
      }
   }

   cacheElements() {
      this.container = this.querySelector('#leak-inspector');
      this.header = this.querySelector('.leak-header');
      this.list = this.querySelector('#leak-list');
      this.countLabel = this.querySelector('#leak-count');
      this.sizeLabel = this.querySelector('#leak-size');
      this.growthLabel = this.querySelector('#leak-growth');
      this.refreshButton = this.querySelector('#leak-refresh');
      this.closeButton = this.querySelector('#leak-close');
   }

   bindEvents() {
      this.refreshButton.addEventListener('click', () => this.render());
      this.closeButton.addEventListener('click', () => this.close());
      // Per-orphan Destroy (event delegation).
      this.list.addEventListener('click', (event) => {
         const button = event.target.closest('[data-destroy]');
         if (!button) return;
         const sliceId = button.getAttribute('data-destroy');
         const component = slice.controller.activeComponents.get(sliceId);
         if (component) {
            slice.controller.destroyComponent(component);
            this.render();
         }
      });
   }

   render() {
      const controller = slice?.controller;
      if (!controller || !(controller.activeComponents instanceof Map)) {
         this.list.textContent = 'Controller not available.';
         return;
      }

      controller.sampleComponentGrowth();
      const orphans = controller.findOrphans();

      this.sizeLabel.textContent = String(controller.activeComponents.size);
      this.countLabel.textContent = String(orphans.length);

      const growing = controller.isGrowthMonotonic();
      this.growthLabel.textContent = growing ? 'growing ▲' : 'stable';
      this.growthLabel.classList.toggle('warn', growing);

      if (orphans.length === 0) {
         this.list.innerHTML = '<div class="empty">No leaks detected ✓</div>';
         return;
      }

      this.list.innerHTML = orphans.map((orphan) => {
         const path = orphan.retainPath.map((p) => this.escapeHtml(p)).join(' ◂ ');
         return `
            <details class="leak-row">
               <summary>
                  <div class="leak-name">${this.escapeHtml(orphan.name)}</div>
                  <div class="leak-actions-row">
                     <span class="leak-id">${this.escapeHtml(orphan.sliceId)}</span>
                     <button class="leak-destroy" data-destroy="${this.escapeHtml(orphan.sliceId)}" title="Destroy now">destroy</button>
                  </div>
               </summary>
               <div class="leak-detail">
                  <div class="leak-reason">${this.escapeHtml(orphan.reason)}</div>
                  <div class="leak-path"><span class="path-key">retains</span> ${path}</div>
               </div>
            </details>
         `;
      }).join('');
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
         const x = Math.min(Math.max(event.clientX - offset.x, 0), window.innerWidth - rect.width);
         const y = Math.min(Math.max(event.clientY - offset.y, 0), window.innerHeight - rect.height);
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

   escapeHtml(value) {
      return String(value)
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;');
   }

   renderTemplate() {
      return `
      <div id="leak-inspector">
         <div class="leak-header">
            <div class="brand">
               <span class="status-dot"></span>
               <span class="glyph">⚠</span>
               <span class="title">LEAK INSPECTOR</span>
            </div>
            <div class="actions">
               <button id="leak-refresh" class="btn" title="Refresh" aria-label="Refresh">⟳</button>
               <button id="leak-close" class="btn" title="Close" aria-label="Close">✕</button>
            </div>
         </div>
         <div class="leak-stats">
            <div class="stat"><span class="stat-label">orphans</span><span id="leak-count" class="stat-value danger">0</span></div>
            <div class="stat"><span class="stat-label">active</span><span id="leak-size" class="stat-value">0</span></div>
            <div class="stat"><span class="stat-label">trend</span><span id="leak-growth" class="stat-value">stable</span></div>
         </div>
         <div class="leak-list" id="leak-list"></div>
      </div>
      `;
   }

   renderStyles() {
      return `
slice-leak-inspector {
   --li-accent: var(--danger-color, #ff6b6b);
   --li-accent-rgb: 255, 107, 107;
   --li-surface: var(--primary-background-color, rgba(17, 19, 28, 0.86));
   --li-raised: var(--secondary-background-color, rgba(255, 255, 255, 0.035));
   --li-raised-2: var(--tertiary-background-color, rgba(255, 255, 255, 0.06));
   --li-border: var(--medium-color, rgba(255, 255, 255, 0.09));
   --li-text: var(--font-primary-color, #e8eaf2);
   --li-dim: var(--font-secondary-color, #888fa6);
   --li-warn: var(--warning-color, #f5b14c);
   --li-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace;
}

slice-leak-inspector #leak-inspector {
   position: fixed;
   bottom: 20px;
   left: 20px;
   width: min(380px, calc(100vw - 40px));
   max-height: 64vh;
   background: var(--li-surface);
   border: 1px solid var(--li-border);
   border-radius: 14px;
   box-shadow: 0 24px 60px -12px rgba(0,0,0,0.55), 0 0 38px -18px rgba(var(--li-accent-rgb), 0.5);
   -webkit-backdrop-filter: blur(22px) saturate(1.3);
   backdrop-filter: blur(22px) saturate(1.3);
   display: none;
   flex-direction: column;
   z-index: 10001;
   overflow: hidden;
   color: var(--li-text);
   font-family: var(--li-mono);
}
slice-leak-inspector #leak-inspector.active {
   display: flex;
   animation: li-in 0.26s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes li-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
slice-leak-inspector #leak-inspector * { box-sizing: border-box; }
slice-leak-inspector #leak-inspector::before {
   content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
   background: linear-gradient(180deg, var(--li-accent), transparent 70%); opacity: 0.85; pointer-events: none;
}

slice-leak-inspector .leak-header {
   display: flex; justify-content: space-between; align-items: center;
   padding: 12px 14px;
   background: radial-gradient(120% 140% at 0% 0%, rgba(var(--li-accent-rgb), 0.1), transparent 60%), var(--li-raised);
   border-bottom: 1px solid var(--li-border); user-select: none;
}
slice-leak-inspector .brand { display: flex; align-items: center; gap: 9px; }
slice-leak-inspector .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--li-accent); animation: li-pulse 2.4s ease-out infinite; }
@keyframes li-pulse { 0% { box-shadow: 0 0 0 0 rgba(var(--li-accent-rgb), 0.55); } 70% { box-shadow: 0 0 0 7px rgba(var(--li-accent-rgb), 0); } 100% { box-shadow: 0 0 0 0 rgba(var(--li-accent-rgb), 0); } }
slice-leak-inspector .glyph { color: var(--li-accent); font-size: 12px; }
slice-leak-inspector .title { font-weight: 600; font-size: 11px; letter-spacing: 0.16em; color: var(--li-text); }
slice-leak-inspector .actions { display: flex; gap: 6px; }
slice-leak-inspector .btn {
   width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
   border-radius: 7px; border: 1px solid var(--li-border); background: var(--li-raised);
   color: var(--li-dim); cursor: pointer; font-size: 13px; line-height: 1;
   transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
slice-leak-inspector .btn:hover { color: var(--li-text); background: var(--li-raised-2); border-color: rgba(var(--li-accent-rgb), 0.5); }
slice-leak-inspector .btn:active { transform: scale(0.92); }

slice-leak-inspector .leak-stats {
   display: flex; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--li-border); background: var(--li-raised);
}
slice-leak-inspector .stat { flex: 1; display: flex; flex-direction: column; gap: 3px; align-items: center; padding: 6px 4px; border-radius: 8px; background: rgba(0,0,0,0.18); border: 1px solid var(--li-border); }
slice-leak-inspector .stat-label { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--li-dim); }
slice-leak-inspector .stat-value { font-size: 16px; font-weight: 700; color: var(--li-text); }
slice-leak-inspector .stat-value.danger { color: var(--li-accent); }
slice-leak-inspector .stat-value.warn { color: var(--li-warn); }

slice-leak-inspector .leak-list { padding: 10px 12px 12px; overflow: auto; display: flex; flex-direction: column; gap: 7px; }
slice-leak-inspector .leak-list::-webkit-scrollbar { width: 8px; }
slice-leak-inspector .leak-list::-webkit-scrollbar-thumb { background: var(--li-raised-2); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }

slice-leak-inspector .leak-row { display: block; padding: 9px 11px; background: var(--li-raised); border-radius: 9px; border: 1px solid var(--li-border); border-left: 2px solid var(--li-accent); }
slice-leak-inspector .leak-row summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; list-style: none; }
slice-leak-inspector .leak-row summary::-webkit-details-marker { display: none; }
slice-leak-inspector .leak-name { font-family: var(--li-mono); font-size: 12px; font-weight: 600; color: var(--li-text); }
slice-leak-inspector .leak-actions-row { display: flex; align-items: center; gap: 8px; }
slice-leak-inspector .leak-id { font-size: 10px; color: var(--li-dim); }
slice-leak-inspector .leak-destroy {
   all: unset; cursor: pointer; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase;
   padding: 2px 8px; border-radius: 999px; color: var(--li-accent);
   background: rgba(var(--li-accent-rgb), 0.12); border: 1px solid rgba(var(--li-accent-rgb), 0.3);
}
slice-leak-inspector .leak-destroy:hover { background: rgba(var(--li-accent-rgb), 0.22); }
slice-leak-inspector .leak-detail { margin-top: 9px; padding-top: 9px; border-top: 1px dashed var(--li-border); display: flex; flex-direction: column; gap: 6px; }
slice-leak-inspector .leak-reason { font-size: 11px; color: var(--li-dim); }
slice-leak-inspector .leak-path { font-family: var(--li-mono); font-size: 10.5px; color: var(--li-text); word-break: break-word; }
slice-leak-inspector .path-key { color: var(--li-dim); margin-right: 6px; }
slice-leak-inspector .empty { color: var(--li-dim); font-size: 11px; letter-spacing: 0.04em; text-align: center; padding: 22px 0; }

@media (prefers-reduced-motion: reduce) {
   slice-leak-inspector #leak-inspector.active { animation: none; }
   slice-leak-inspector .status-dot { animation: none; }
}
      `;
   }
}

customElements.define('slice-leak-inspector', LeakInspector);
