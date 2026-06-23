/**
 * EventManager debug panel.
 */
export default class EventManagerDebugger extends HTMLElement {
   constructor() {
      super();
      this.isOpen = false;
      this.filterText = '';
      this.activeTab = 'subscribers';
      this.refreshInterval = null;
      this._autoRefreshTimer = null;
      this._lastHistoryLength = 0;
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
      this._loadStaticGraph();
      this.renderList();
   }

   /**
    * Best-effort load of the generated static event graph (documentation layer).
    * Produced by `slice types generate` at /slice-events.generated.js. Absent =>
    * the Registry tab simply shows no static emitters/listeners (no error).
    */
   async _loadStaticGraph() {
      if (slice.events?.graph) return;
      try {
         const module = await import(/* @vite-ignore */ '/slice-events.generated.js');
         if (module?.default) slice.events.loadGraph(module.default);
         if (this.isOpen && this.activeTab === 'registry') this.renderRegistry();
      } catch {
         /* manifest not generated — documentation layer stays empty, runtime tracing still works */
      }
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
      this.activeTab = 'subscribers';
      if (slice.events) {
         slice.events.startRecording();
      }
      this._startAutoRefresh();
      this.renderList();
   }

   /**
    * Hide panel.
    * @returns {void}
    */
   close() {
      this.isOpen = false;
      this.container.classList.remove('active');
      this._stopAutoRefresh();
      if (slice.events) {
         slice.events.stopRecording();
      }
   }

   _startAutoRefresh() {
      this._stopAutoRefresh();
      this._autoRefreshTimer = setInterval(() => {
         if (!this.isOpen) return;
         this._renderActive();
      }, 1500);
   }

   _stopAutoRefresh() {
      if (this._autoRefreshTimer) {
         clearInterval(this._autoRefreshTimer);
         this._autoRefreshTimer = null;
      }
   }

   cacheElements() {
      this.container = this.querySelector('#events-debugger');
      this.header = this.querySelector('.events-header');
      this.list = this.querySelector('#events-list');
      this.filterInput = this.querySelector('#events-filter');
      this.countLabel = this.querySelector('#events-count');
      this.refreshButton = this.querySelector('#events-refresh');
      this.closeButton = this.querySelector('#events-close');
      this.tabSubs = this.querySelector('#tab-subscribers');
      this.tabRegistry = this.querySelector('#tab-registry');
      this.tabHistory = this.querySelector('#tab-history');
   }

   bindEvents() {
      this.refreshButton.addEventListener('click', () => this._renderActive());
      this.closeButton.addEventListener('click', () => this.close());
      this.filterInput.addEventListener('input', (event) => {
         this.filterText = event.target.value.trim().toLowerCase();
         this._renderActive();
      });
      this.tabSubs.addEventListener('click', () => this._selectTab('subscribers'));
      this.tabRegistry.addEventListener('click', () => this._selectTab('registry'));
      this.tabHistory.addEventListener('click', () => this._selectTab('history'));
   }

   _selectTab(tab) {
      this.activeTab = tab;
      this.tabSubs.classList.toggle('active', tab === 'subscribers');
      this.tabRegistry.classList.toggle('active', tab === 'registry');
      this.tabHistory.classList.toggle('active', tab === 'history');
      const placeholders = { subscribers: 'filter events…', registry: 'filter registry…', history: 'filter history…' };
      this.filterInput.placeholder = placeholders[tab] || 'filter…';
      this._renderActive();
   }

   _renderActive() {
      if (this.activeTab === 'history') this.renderHistory();
      else if (this.activeTab === 'registry') this.renderRegistry();
      else this.renderList();
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
         const emitCount = slice.events.emitCounts?.get(eventName) || 0;
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

         items.push({ eventName, count: subs.size, emitCount, entries, emitters: this._emittersFor(eventName) });
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
                      <div class="subscriber-name">${this.escapeHtml(label)}</div>
                      <div class="subscriber-meta">${entry.id}${onceBadge}</div>
                   </div>
                `;
               }).join('');

               const emittersHtml = item.emitters.length
                  ? item.emitters.map((emitter) => `
                       <div class="subscriber-row emitter-row">
                          <div class="subscriber-name">${this.escapeHtml(this._emitterLabel(emitter))}</div>
                          <div class="subscriber-meta">×${emitter.count}</div>
                       </div>
                    `).join('')
                  : '<div class="empty">No emitters recorded</div>';

               return `
                <details class="event-row">
                   <summary>
                      <div class="event-name">${this.escapeHtml(item.eventName)}</div>
                      <div class="event-metrics">
                         <span class="emit-count" title="Emits this session">⚡${item.emitCount}</span>
                         <span class="event-count">${item.count}</span>
                      </div>
                   </summary>
                   <div class="trace-section">
                      <div class="trace-label">emitted by</div>
                      ${emittersHtml}
                   </div>
                   <div class="trace-section">
                      <div class="trace-label">listeners</div>
                      ${details || '<div class="empty">No subscribers</div>'}
                   </div>
                </details>
             `;
            }).join('')
          : '<div class="empty">No events</div>';
   }

   /**
    * Emitters recorded for an event (only while the debugger is open).
    * @param {string} eventName
    * @returns {Array<{ sliceId?: string, name?: string, source?: string, count: number }>}
    */
   _emittersFor(eventName) {
      const map = slice?.events?.emitters;
      if (!(map instanceof Map) || !map.has(eventName)) return [];
      return Array.from(map.get(eventName).values()).sort((a, b) => b.count - a.count);
   }

   /**
    * Human-readable label for an emitter (component name + sliceId, or source location).
    */
   _emitterLabel(emitter) {
      if (!emitter) return 'unknown';
      if (emitter.sliceId) return `${emitter.name || 'Component'} (${emitter.sliceId})`;
      if (emitter.source) return emitter.source;
      return 'unknown';
   }

   /**
    * Render the declared event catalog (registry) merged with the live state:
    * payload shape, current subscriber count, emit count, plus drift badges for
    * declared-but-unused and used-but-undeclared events.
    */
   renderRegistry() {
      if (!slice?.events) {
         this.list.textContent = 'EventManager not available.';
         this.countLabel.textContent = '0';
         return;
      }

      const registry = slice.events.registry instanceof Map ? slice.events.registry : new Map();
      const undeclared = slice.events.undeclared instanceof Set ? slice.events.undeclared : new Set();

      if (registry.size === 0 && undeclared.size === 0) {
         this.countLabel.textContent = '0';
         this.list.innerHTML =
            '<div class="empty">No events registered.<br/>Declare them with <code>slice.events.register({ ... })</code>.</div>';
         return;
      }

      const matchesFilter = (name) => !this.filterText || name.toLowerCase().includes(this.filterText);

      // Bucket declared events by namespace (segment before the first ':').
      const groups = new Map();
      registry.forEach((definition, eventName) => {
         if (!matchesFilter(eventName)) return;
         const ns = slice.events.namespaceOf?.(eventName) || '(no namespace)';
         if (!groups.has(ns)) groups.set(ns, []);
         groups.get(ns).push({
            eventName,
            description: definition?.description || '',
            payload: definition?.payload ?? null,
            subscriberCount: slice.events.subscriberCount?.(eventName) || 0,
            emitCount: slice.events.emitCounts?.get(eventName) || 0
         });
      });

      const sortedNamespaces = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
      const declaredCount = Array.from(groups.values()).reduce((sum, list) => sum + list.length, 0);
      const drift = Array.from(undeclared).filter(matchesFilter).sort();

      this.countLabel.textContent = String(declaredCount + drift.length);

      const siteRows = (sites) => sites.map((s) => {
         const label = s.component ? `${s.component} — ${s.file}:${s.line}` : `${s.file}:${s.line}`;
         return `<div class="graph-site">${this.escapeHtml(label)}</div>`;
      }).join('');

      const eventRowHtml = (item) => {
         const payloadStr = this.formatPayload(item.payload);
         const idle = item.subscriberCount === 0
            ? '<span class="badge badge-idle" title="No active listeners">idle</span>'
            : '';
         const desc = item.description
            ? `<div class="registry-desc">${this.escapeHtml(item.description)}</div>`
            : '';

         // Static documentation layer (from the generated manifest).
         const emitters = slice.events.staticEmittersOf?.(item.eventName) || [];
         const listeners = slice.events.staticListenersOf?.(item.eventName) || [];
         const graphHtml = (emitters.length || listeners.length)
            ? `
               <div class="graph-block">
                  <div class="graph-label">emitters <span class="graph-tag">static</span></div>
                  ${emitters.length ? siteRows(emitters) : '<div class="empty">none found in code</div>'}
                  <div class="graph-label">listeners <span class="graph-tag">static</span></div>
                  ${listeners.length ? siteRows(listeners) : '<div class="empty">none found in code</div>'}
               </div>`
            : '';

         return `
            <details class="event-row">
               <summary>
                  <div class="event-name">${this.escapeHtml(item.eventName)}</div>
                  <div class="event-metrics">
                     ${idle}
                     <span class="emit-count" title="Emits this session">⚡${item.emitCount}</span>
                     <span class="event-count" title="Active listeners">${item.subscriberCount}</span>
                  </div>
               </summary>
               <div class="subscriber-list">
                  ${desc}
                  <div class="registry-payload"><span class="payload-key">payload</span> ${this.escapeHtml(payloadStr)}</div>
                  ${graphHtml}
               </div>
            </details>
         `;
      };

      const declaredHtml = sortedNamespaces.map((ns) => {
         const list = groups.get(ns).sort((a, b) => a.eventName.localeCompare(b.eventName));
         const rows = list.map(eventRowHtml).join('');
         return `
            <details class="ns-group" open>
               <summary class="ns-summary">
                  <span class="ns-name">${this.escapeHtml(ns)}</span>
                  <span class="ns-count">${list.length}</span>
               </summary>
               <div class="ns-events">${rows}</div>
            </details>
         `;
      }).join('');

      const driftHtml = drift.length
         ? `<div class="registry-drift-title">Used but not declared (${drift.length})</div>` +
           drift.map((name) => `
               <div class="history-row drift-row">
                  <div class="history-event">${this.escapeHtml(name)}</div>
                  <div class="history-time"><span class="badge badge-drift">undeclared</span></div>
               </div>
            `).join('')
         : '';

      // Footer: dynamic emit/subscribe sites (computed names the static scan can't resolve).
      const dynamic = slice.events.graph?.dynamic;
      const dynamicCount = (dynamic?.emitters?.length || 0) + (dynamic?.listeners?.length || 0);
      const dynamicHtml = dynamicCount
         ? `<div class="registry-drift-title">Dynamic sites (computed names, ${dynamicCount}) — not statically resolvable</div>`
         : '';

      this.list.innerHTML =
         (declaredHtml || (drift.length ? '' : '<div class="empty">No matching events</div>')) + driftHtml + dynamicHtml;
   }

   /**
    * Render a payload mini-schema for display.
    * @param {object|null} payload
    * @returns {string}
    */
   formatPayload(payload) {
      if (payload === null || payload === undefined) return 'void';
      if (typeof payload === 'string') return payload;
      if (typeof payload === 'object') {
         const parts = Object.entries(payload).map(([key, value]) => {
            const type = typeof value === 'string'
               ? value
               : (value && typeof value === 'object' && value.type) || 'any';
            return `${key}: ${type}`;
         });
         return `{ ${parts.join(', ')} }`;
      }
      return String(payload);
   }

   renderHistory() {
      if (!slice?.events?.emitHistory) {
         this.list.textContent = 'EventManager not available.';
         this.countLabel.textContent = '0';
         return;
      }

      const history = slice.events.emitHistory;
      const filtered = this.filterText
         ? history.filter(e => e.eventName.toLowerCase().includes(this.filterText))
         : history;

      this.countLabel.textContent = String(filtered.length);
      if (!filtered.length) {
         this.list.innerHTML = '<div class="empty">No emits recorded yet</div>';
         return;
      }

      const now = Date.now();
      this.list.innerHTML = [...filtered].reverse().map((entry) => {
         const diff = now - entry.timestamp;
         const timeStr = diff < 1000 ? 'now'
            : diff < 60000 ? `${Math.floor(diff / 1000)}s ago`
            : `${Math.floor(diff / 60000)}m ago`;
         const from = entry.emitter
            ? `<div class="history-from" title="Emitter">↑ ${this.escapeHtml(this._emitterLabel(entry.emitter))}</div>`
            : '';
         return `
            <div class="history-row">
               <div class="history-main">
                  <div class="history-event">${this.escapeHtml(entry.eventName)}</div>
                  ${from}
               </div>
               <div class="history-time">${timeStr}</div>
            </div>
         `;
      }).join('');
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
      <div id="events-debugger">
         <div class="events-header">
            <div class="brand">
               <span class="status-dot"></span>
               <span class="glyph">◇</span>
               <span class="title">EVENTS</span>
            </div>
            <div class="actions">
               <button id="events-refresh" class="btn" title="Refresh" aria-label="Refresh">⟳</button>
               <button id="events-close" class="btn" title="Close" aria-label="Close">✕</button>
            </div>
         </div>
         <div class="events-tabs">
            <button id="tab-subscribers" class="tab-btn active">Subscribers</button>
            <button id="tab-registry" class="tab-btn">Registry</button>
            <button id="tab-history" class="tab-btn">History</button>
         </div>
         <div class="events-toolbar">
            <input id="events-filter" type="text" placeholder="filter events…" autocomplete="off" spellcheck="false" />
            <div class="count"><span id="events-count">0</span></div>
         </div>
         <div class="events-list" id="events-list"></div>
      </div>
      `;
   }

   renderStyles() {
      return `
/* Slice Instruments — events console. All selectors scoped to the
    <slice-eventmanager-debugger> tag so nothing clashes with app styles.
    Every --si-* token reads the matching framework theme variable from
    :root, falling back to the original hardcoded value if absent. */
slice-eventmanager-debugger {
    --si-accent: var(--primary-color, #6ee7ff);
    --si-accent-rgb: var(--primary-color-rgb, 110, 231, 255);
    --si-surface: var(--primary-background-color, rgba(17, 19, 28, 0.86));
    --si-raised: var(--secondary-background-color, rgba(255, 255, 255, 0.035));
    --si-raised-2: var(--tertiary-background-color, rgba(255, 255, 255, 0.06));
    --si-border: var(--medium-color, rgba(255, 255, 255, 0.09));
    --si-text: var(--font-primary-color, #e8eaf2);
    --si-dim: var(--font-secondary-color, #888fa6);
    --si-danger: var(--danger-color, #ff6b6b);
    --si-success: var(--success-color, #46d39a);
    --si-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace;
 }

slice-eventmanager-debugger #events-debugger {
   position: fixed;
   bottom: 20px;
   right: 20px;
   width: min(380px, calc(100vw - 40px));
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

slice-eventmanager-debugger #events-debugger.active {
   display: flex;
   animation: si-events-in 0.26s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes si-events-in {
   from { opacity: 0; transform: translateY(10px) scale(0.985); }
   to   { opacity: 1; transform: translateY(0) scale(1); }
}

slice-eventmanager-debugger #events-debugger * { box-sizing: border-box; }

slice-eventmanager-debugger #events-debugger::before {
   content: '';
   position: absolute;
   left: 0; top: 0; bottom: 0;
   width: 2px;
   background: linear-gradient(180deg, var(--si-accent), transparent 70%);
   opacity: 0.85;
   pointer-events: none;
}

slice-eventmanager-debugger .events-header {
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

slice-eventmanager-debugger .brand { display: flex; align-items: center; gap: 9px; }

slice-eventmanager-debugger .status-dot {
   width: 7px; height: 7px;
   border-radius: 50%;
   background: var(--si-accent);
   animation: si-pulse-ev 2.4s ease-out infinite;
}

@keyframes si-pulse-ev {
   0%   { box-shadow: 0 0 0 0 rgba(var(--si-accent-rgb), 0.55); }
   70%  { box-shadow: 0 0 0 7px rgba(var(--si-accent-rgb), 0); }
   100% { box-shadow: 0 0 0 0 rgba(var(--si-accent-rgb), 0); }
}

slice-eventmanager-debugger .glyph { color: var(--si-accent); font-size: 12px; opacity: 0.9; }

slice-eventmanager-debugger .title {
   font-weight: 600;
   font-size: 11px;
   letter-spacing: 0.18em;
   color: var(--si-text);
}

slice-eventmanager-debugger .actions { display: flex; gap: 6px; }

slice-eventmanager-debugger .btn {
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
slice-eventmanager-debugger .btn:hover {
   color: var(--si-text);
   background: var(--si-raised-2);
   border-color: rgba(var(--si-accent-rgb), 0.5);
}
slice-eventmanager-debugger .btn:active { transform: scale(0.92); }
slice-eventmanager-debugger #events-refresh:hover { color: var(--si-accent); }

slice-eventmanager-debugger .events-tabs {
   display: flex;
   gap: 0;
   padding: 0 12px;
   border-bottom: 1px solid var(--si-border);
   background: var(--si-raised);
}
slice-eventmanager-debugger .tab-btn {
   all: unset;
   cursor: pointer;
   font-size: 10px;
   font-weight: 600;
   letter-spacing: 0.06em;
   text-transform: uppercase;
   padding: 7px 12px;
   color: var(--si-dim);
   border-bottom: 2px solid transparent;
   transition: color 0.15s ease, border-color 0.15s ease;
}
slice-eventmanager-debugger .tab-btn:hover { color: var(--si-text); }
slice-eventmanager-debugger .tab-btn.active {
   color: var(--si-accent);
   border-bottom-color: var(--si-accent);
}

slice-eventmanager-debugger .events-toolbar {
   display: flex;
   gap: 10px;
   align-items: center;
   padding: 10px 12px;
   border-bottom: 1px solid var(--si-border);
}

slice-eventmanager-debugger .events-toolbar input {
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
slice-eventmanager-debugger .events-toolbar input::placeholder { color: var(--si-dim); }
slice-eventmanager-debugger .events-toolbar input:focus {
   outline: none;
   border-color: rgba(var(--si-accent-rgb), 0.6);
   box-shadow: 0 0 0 3px rgba(var(--si-accent-rgb), 0.12);
}

slice-eventmanager-debugger .events-toolbar .count { font-size: 11px; color: var(--si-dim); min-width: 22px; text-align: center; }
slice-eventmanager-debugger .events-toolbar .count span { color: var(--si-accent); font-weight: 600; }

slice-eventmanager-debugger .events-list {
   padding: 10px 12px 12px;
   overflow: auto;
   display: flex;
   flex-direction: column;
   gap: 7px;
}
slice-eventmanager-debugger .events-list::-webkit-scrollbar { width: 8px; }
slice-eventmanager-debugger .events-list::-webkit-scrollbar-thumb {
   background: var(--si-raised-2);
   border-radius: 8px;
   border: 2px solid transparent;
   background-clip: padding-box;
}
slice-eventmanager-debugger .events-list::-webkit-scrollbar-thumb:hover { background: rgba(var(--si-accent-rgb), 0.4); background-clip: padding-box; }

slice-eventmanager-debugger .event-row {
   display: block;
   padding: 9px 11px;
   background: var(--si-raised);
   border-radius: 9px;
   border: 1px solid var(--si-border);
   border-left: 2px solid transparent;
   transition: border-color 0.18s ease, background 0.18s ease;
}
slice-eventmanager-debugger .event-row:hover { background: var(--si-raised-2); border-left-color: var(--si-accent); }

slice-eventmanager-debugger .event-row summary {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 10px;
   cursor: pointer;
   list-style: none;
}
slice-eventmanager-debugger .event-row summary::-webkit-details-marker { display: none; }
slice-eventmanager-debugger .event-row summary::after {
   content: '›';
   margin-left: auto;
   color: var(--si-dim);
   font-size: 15px;
   line-height: 1;
   transition: transform 0.2s ease, color 0.2s ease;
}
slice-eventmanager-debugger .event-row[open] summary::after { transform: rotate(90deg); color: var(--si-accent); }

slice-eventmanager-debugger .event-name {
   font-family: var(--si-mono);
   font-size: 12px;
   color: var(--si-text);
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

slice-eventmanager-debugger .event-metrics {
   display: flex;
   align-items: center;
   gap: 6px;
}
slice-eventmanager-debugger .emit-count {
   font-weight: 600;
   font-size: 10px;
   color: var(--si-success);
   background: rgba(70, 211, 154, 0.12);
   border: 1px solid rgba(70, 211, 154, 0.25);
   padding: 1px 6px;
   border-radius: 999px;
   white-space: nowrap;
}
slice-eventmanager-debugger .event-count {
   font-weight: 600;
   font-size: 11px;
   color: var(--si-accent);
   background: rgba(var(--si-accent-rgb), 0.12);
   border: 1px solid rgba(var(--si-accent-rgb), 0.25);
   padding: 1px 8px;
   border-radius: 999px;
   min-width: 22px;
   text-align: center;
}
slice-eventmanager-debugger .history-row {
   display: flex;
   justify-content: space-between;
   align-items: center;
   gap: 10px;
   padding: 6px 11px;
   background: var(--si-raised);
   border-radius: 7px;
   border: 1px solid var(--si-border);
   border-left: 2px solid transparent;
   transition: border-color 0.15s ease;
}
slice-eventmanager-debugger .history-row:hover { border-left-color: var(--si-accent); }
slice-eventmanager-debugger .history-event {
   font-family: var(--si-mono);
   font-size: 11.5px;
   color: var(--si-text);
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}
slice-eventmanager-debugger .history-time {
   font-size: 10px;
   color: var(--si-dim);
   white-space: nowrap;
   flex-shrink: 0;
}

slice-eventmanager-debugger .subscriber-list {
   margin-top: 9px;
   padding-top: 9px;
   border-top: 1px dashed var(--si-border);
   display: flex;
   flex-direction: column;
   gap: 6px;
}

slice-eventmanager-debugger .subscriber-row {
   display: flex;
   justify-content: space-between;
   align-items: center;
   gap: 10px;
   padding: 6px 9px;
   border-radius: 7px;
   background: rgba(0, 0, 0, 0.22);
   border: 1px solid var(--si-border);
}

slice-eventmanager-debugger .subscriber-name {
   font-size: 11.5px;
   color: var(--si-text);
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

slice-eventmanager-debugger .subscriber-meta {
   font-size: 10.5px;
   color: var(--si-dim);
   display: flex;
   align-items: center;
   gap: 6px;
   white-space: nowrap;
}

slice-eventmanager-debugger .badge {
   padding: 1px 6px;
   border-radius: 999px;
   background: rgba(var(--si-accent-rgb), 0.16);
   color: var(--si-accent);
   border: 1px solid rgba(var(--si-accent-rgb), 0.3);
   font-size: 9px;
   letter-spacing: 0.06em;
   text-transform: uppercase;
}

slice-eventmanager-debugger .empty {
   color: var(--si-dim);
   font-size: 11px;
   letter-spacing: 0.04em;
   text-align: center;
   padding: 22px 0;
}
slice-eventmanager-debugger .empty code {
   font-family: var(--si-mono);
   color: var(--si-accent);
   background: rgba(var(--si-accent-rgb), 0.1);
   padding: 1px 5px;
   border-radius: 5px;
}

slice-eventmanager-debugger .registry-desc {
   font-size: 11px;
   color: var(--si-dim);
   padding: 4px 2px 2px;
   line-height: 1.4;
}
slice-eventmanager-debugger .registry-payload {
   font-family: var(--si-mono);
   font-size: 11px;
   color: var(--si-text);
   padding: 6px 9px;
   border-radius: 7px;
   background: rgba(0, 0, 0, 0.22);
   border: 1px solid var(--si-border);
   word-break: break-word;
}
slice-eventmanager-debugger .payload-key {
   color: var(--si-dim);
   margin-right: 6px;
}
slice-eventmanager-debugger .badge-idle {
   background: rgba(136, 143, 166, 0.14);
   color: var(--si-dim);
   border: 1px solid var(--si-border);
}
slice-eventmanager-debugger .badge-drift {
   background: rgba(255, 107, 107, 0.14);
   color: var(--si-danger);
   border: 1px solid rgba(255, 107, 107, 0.3);
}
slice-eventmanager-debugger .registry-drift-title {
   margin-top: 4px;
   font-size: 9.5px;
   letter-spacing: 0.1em;
   text-transform: uppercase;
   color: var(--si-danger);
   opacity: 0.85;
}
slice-eventmanager-debugger .drift-row { border-left-color: rgba(255, 107, 107, 0.4); }

slice-eventmanager-debugger .ns-group { display: block; }
slice-eventmanager-debugger .ns-group + .ns-group { margin-top: 4px; }
slice-eventmanager-debugger .ns-summary {
   display: flex; align-items: center; gap: 8px; cursor: pointer; list-style: none;
   padding: 4px 2px 6px; user-select: none;
}
slice-eventmanager-debugger .ns-summary::-webkit-details-marker { display: none; }
slice-eventmanager-debugger .ns-summary::before {
   content: '▾'; color: var(--si-dim); font-size: 10px; transition: transform 0.2s ease;
}
slice-eventmanager-debugger .ns-group:not([open]) .ns-summary::before { transform: rotate(-90deg); }
slice-eventmanager-debugger .ns-name {
   font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--si-accent);
}
slice-eventmanager-debugger .ns-count {
   font-size: 9.5px; color: var(--si-dim);
   background: var(--si-raised-2); border: 1px solid var(--si-border);
   border-radius: 999px; padding: 0 6px;
}
slice-eventmanager-debugger .ns-events { display: flex; flex-direction: column; gap: 7px; padding-left: 4px; }

slice-eventmanager-debugger .trace-section {
   margin-top: 9px;
   padding-top: 9px;
   border-top: 1px dashed var(--si-border);
   display: flex;
   flex-direction: column;
   gap: 6px;
}
slice-eventmanager-debugger .trace-label {
   font-size: 9px;
   font-weight: 700;
   letter-spacing: 0.1em;
   text-transform: uppercase;
   color: var(--si-dim);
}
slice-eventmanager-debugger .emitter-row { border-left: 2px solid var(--si-success); }
slice-eventmanager-debugger .emitter-row .subscriber-name { color: var(--si-text); }

slice-eventmanager-debugger .history-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
slice-eventmanager-debugger .history-from {
   font-size: 10px;
   color: var(--si-success);
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

slice-eventmanager-debugger .graph-block {
   margin-top: 8px;
   padding-top: 8px;
   border-top: 1px dashed var(--si-border);
   display: flex;
   flex-direction: column;
   gap: 4px;
}
slice-eventmanager-debugger .graph-label {
   font-size: 9px;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: var(--si-dim);
   margin-top: 4px;
   display: flex;
   align-items: center;
   gap: 6px;
}
slice-eventmanager-debugger .graph-tag {
   font-size: 8px;
   font-weight: 600;
   letter-spacing: 0.04em;
   color: var(--si-accent);
   background: rgba(var(--si-accent-rgb), 0.12);
   border: 1px solid rgba(var(--si-accent-rgb), 0.25);
   border-radius: 999px;
   padding: 0 5px;
}
slice-eventmanager-debugger .graph-site {
   font-family: var(--si-mono);
   font-size: 10.5px;
   color: var(--si-text);
   padding: 3px 8px;
   border-radius: 6px;
   background: rgba(0, 0, 0, 0.2);
   border: 1px solid var(--si-border);
   word-break: break-word;
}

@media (prefers-reduced-motion: reduce) {
   slice-eventmanager-debugger #events-debugger.active { animation: none; }
   slice-eventmanager-debugger .status-dot { animation: none; }
}
      `;
   }
}

customElements.define('slice-eventmanager-debugger', EventManagerDebugger);
