/**
 * Translator debug panel: the active locale, a switcher, the keys the current page needs
 * that the active locale does not have, and a "show keys" switch.
 *
 * All the data comes from `slice.translator`; the panel never changes how the app
 * translates except through the two documented debugger entry points (`setLocale` and
 * `setShowKeys`).
 */
import { templateKeys } from './dom.js';

export default class TranslatorDebugger extends HTMLElement {
   constructor() {
      super();
      this.isOpen = false;
      this._changeSubscription = null;
      this._renderTimer = null;
   }

   async init() {
      this.innerHTML = this.renderTemplate();
      slice.stylesManager.registerComponentStyles('TranslatorDebugger', this.renderStyles());
      this.cacheElements();
      this.bindEvents();
      this.makeDraggable();
      this._subscribe();
      this.render();
   }

   toggle() {
      this.isOpen = !this.isOpen;
      this.container.classList.toggle('active', this.isOpen);
      if (this.isOpen) this.render();
   }

   open() {
      this.isOpen = true;
      this.container.classList.add('active');
      this.render();
   }

   close() {
      this.isOpen = false;
      this.container.classList.remove('active');
   }

   disconnectedCallback() {
      if (this._changeSubscription && slice.events?.unsubscribe) {
         slice.events.unsubscribe('translator:change', this._changeSubscription);
      }
      this._changeSubscription = null;
   }

   _subscribe() {
      if (this._changeSubscription || typeof slice.events?.subscribe !== 'function') return;
      this._changeSubscription = slice.events.subscribe('translator:change', () => this._scheduleRender());
   }

   _scheduleRender() {
      if (this._renderTimer) clearTimeout(this._renderTimer);
      this._renderTimer = setTimeout(() => {
         if (this.isOpen) this.render();
      }, 40);
   }

   cacheElements() {
      this.container = this.querySelector('#translator-debugger');
      this.header = this.querySelector('.translator-header');
      this.localeLabel = this.querySelector('#translator-locale');
      this.localeButtons = this.querySelector('#translator-locales');
      this.showKeysInput = this.querySelector('#translator-show-keys');
      this.missingCount = this.querySelector('#translator-missing-count');
      this.meta = this.querySelector('#translator-meta');
      this.list = this.querySelector('#translator-missing');
      this.refreshButton = this.querySelector('#translator-refresh');
      this.closeButton = this.querySelector('#translator-close');
   }

   bindEvents() {
      this.refreshButton.addEventListener('click', () => this.render());
      this.closeButton.addEventListener('click', () => this.close());
      this.showKeysInput.addEventListener('change', (event) => {
         slice.translator?.setShowKeys?.(event.target.checked);
         this.render();
      });
      this.localeButtons.addEventListener('click', (event) => {
         const button = event.target.closest('[data-locale]');
         if (button) void this._switchLocale(button.dataset.locale);
      });
   }

   async _switchLocale(locale) {
      try {
         await slice.translator.setLocale(locale);
      } catch (error) {
         slice.logger?.logError?.('TranslatorDebugger', `Could not switch to "${locale}"`, error);
      }
      this.render();
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

   render() {
      const translator = slice.translator;
      if (!translator) {
         this.meta.textContent = 'slice.translator is not available.';
         this.list.innerHTML = '';
         return;
      }

      this.localeLabel.textContent = translator.locale || '—';
      this.showKeysInput.checked = translator.showKeys === true;
      this.localeButtons.innerHTML = (translator.locales || [])
         .map((locale) => `
            <button type="button" class="locale${locale === translator.locale ? ' active' : ''}"
               data-locale="${this.escapeHtml(locale)}" aria-pressed="${locale === translator.locale}">
               ${this.escapeHtml(locale)}
            </button>
         `)
         .join('');

      this.meta.textContent = [
         `default ${translator.defaultLocale}`,
         translator.fallbackLocale ? `fallback ${translator.fallbackLocale}` : 'no fallback',
         translator.localePrefix ? `localePrefix ${translator.localePrefix}` : 'locale not in the URL',
         translator.enabled ? 'enabled' : 'disabled'
      ].join(' · ');

      if (!translator.enabled) {
         this.missingCount.textContent = '0';
         this.list.innerHTML = '<div class="empty">Translator disabled in sliceConfig.json</div>';
         return;
      }

      const { missing, fallback } = this._scanPage();
      this.missingCount.textContent = String(missing.length);
      this.list.innerHTML = [...missing, ...fallback].length
         ? [...missing, ...fallback].map((item) => `
            <div class="key-row ${item.kind}">
               <code class="key">${this.escapeHtml(item.key)}</code>
               <span class="where">${this.escapeHtml(item.where)}</span>
               <span class="tag">${item.kind}</span>
            </div>
         `).join('')
         : '<div class="empty">Every key on this page resolves</div>';
   }

   /**
    * `data-t` elements on the page, split into keys absent everywhere (the key is on
    * screen) and keys answered by the fallback locale.
    */
   _scanPage() {
      const translator = slice.translator;
      const missing = new Map();
      const fallback = new Map();
      const add = (map, key, where) => {
         const current = map.get(key);
         if (current) current.count += 1;
         else map.set(key, { key, where, count: 1, kind: map === missing ? 'missing' : 'fallback' });
      };

      for (const element of document.querySelectorAll('[data-t]')) {
         const keys = templateKeys(element);
         if (!keys) continue;
         const needed = [keys.text, ...Object.values(keys.attributes)].filter(Boolean);
         for (const key of needed) {
            if (translator.has(key)) continue;
            if (translator.fallbackLocale && translator.has(key, translator.fallbackLocale)) {
               add(fallback, key, `<${element.tagName.toLowerCase()}>`);
            } else {
               add(missing, key, `<${element.tagName.toLowerCase()}>`);
            }
         }
      }

      const toList = (map) => [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
      return { missing: toList(missing), fallback: toList(fallback) };
   }

   escapeHtml(value) {
      return String(value ?? '')
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#39;');
   }

   renderTemplate() {
      return `
      <div id="translator-debugger">
         <div class="translator-header">
            <div class="brand">
               <span class="status-dot"></span>
               <span class="glyph">文</span>
               <span class="title">TRANSLATOR</span>
            </div>
            <div class="actions">
               <button id="translator-refresh" class="btn" title="Refresh" aria-label="Refresh">⟳</button>
               <button id="translator-close" class="btn" title="Close" aria-label="Close">✕</button>
            </div>
         </div>
         <div class="translator-toolbar">
            <span id="translator-locale" class="pill">—</span>
            <div id="translator-locales" class="locales"></div>
            <label class="keys-toggle">
               <input id="translator-show-keys" type="checkbox" /> keys
            </label>
            <div class="count"><span id="translator-missing-count">0</span> missing</div>
         </div>
         <div class="translator-meta" id="translator-meta"></div>
         <div class="translator-list" id="translator-missing"></div>
      </div>
      `;
   }

   renderStyles() {
      return `
/* Slice Instruments — translator. Scoped to <slice-translator-debugger>; every --si-*
   token reads the framework theme variable, with the instrument value as fallback. */
slice-translator-debugger {
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

slice-translator-debugger #translator-debugger {
   position: fixed;
   bottom: 20px;
   right: 20px;
   width: min(430px, calc(100vw - 40px));
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
   z-index: 10002;
   overflow: hidden;
   color: var(--si-text);
   font-family: var(--si-mono);
}

slice-translator-debugger #translator-debugger.active {
   display: flex;
   animation: si-translator-in 0.26s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes si-translator-in {
   from { opacity: 0; transform: translateY(10px) scale(0.985); }
   to   { opacity: 1; transform: translateY(0) scale(1); }
}

slice-translator-debugger #translator-debugger * { box-sizing: border-box; }

slice-translator-debugger #translator-debugger::before {
   content: '';
   position: absolute;
   left: 0; top: 0; bottom: 0;
   width: 2px;
   background: linear-gradient(180deg, var(--si-accent), transparent 70%);
   opacity: 0.85;
   pointer-events: none;
}

slice-translator-debugger .translator-header {
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

slice-translator-debugger .brand { display: flex; align-items: center; gap: 9px; }

slice-translator-debugger .status-dot {
   width: 7px; height: 7px;
   border-radius: 50%;
   background: var(--si-accent);
   animation: si-pulse-tr 2.4s ease-out infinite;
}

@keyframes si-pulse-tr {
   0%   { box-shadow: 0 0 0 0 rgba(var(--si-accent-rgb), 0.55); }
   70%  { box-shadow: 0 0 0 7px rgba(var(--si-accent-rgb), 0); }
   100% { box-shadow: 0 0 0 0 rgba(var(--si-accent-rgb), 0); }
}

slice-translator-debugger .glyph { color: var(--si-accent); font-size: 12px; opacity: 0.9; }

slice-translator-debugger .title {
   font-weight: 600;
   font-size: 11px;
   letter-spacing: 0.18em;
   color: var(--si-text);
}

slice-translator-debugger .actions { display: flex; gap: 6px; }

slice-translator-debugger .btn {
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
slice-translator-debugger .btn:hover {
   color: var(--si-text);
   background: var(--si-raised-2);
   border-color: rgba(var(--si-accent-rgb), 0.5);
}
slice-translator-debugger .btn:active { transform: scale(0.92); }

slice-translator-debugger .translator-toolbar {
   display: flex;
   gap: 9px;
   align-items: center;
   padding: 10px 12px;
   border-bottom: 1px solid var(--si-border);
}

slice-translator-debugger .pill {
   padding: 3px 9px;
   border-radius: 999px;
   background: rgba(var(--si-accent-rgb), 0.12);
   border: 1px solid rgba(var(--si-accent-rgb), 0.28);
   color: var(--si-accent);
   font-size: 11px;
   font-weight: 600;
   text-transform: uppercase;
   letter-spacing: 0.08em;
}

slice-translator-debugger .locales { display: flex; gap: 4px; }

slice-translator-debugger .locale {
   padding: 3px 8px;
   border-radius: 7px;
   border: 1px solid var(--si-border);
   background: var(--si-raised);
   color: var(--si-dim);
   font: inherit;
   font-size: 11px;
   cursor: pointer;
   transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
slice-translator-debugger .locale:hover { color: var(--si-text); background: var(--si-raised-2); }
slice-translator-debugger .locale.active {
   color: var(--si-accent);
   border-color: rgba(var(--si-accent-rgb), 0.5);
   background: rgba(var(--si-accent-rgb), 0.12);
}

slice-translator-debugger .keys-toggle {
   display: inline-flex;
   align-items: center;
   gap: 5px;
   margin-left: auto;
   color: var(--si-dim);
   font-size: 11px;
   cursor: pointer;
   user-select: none;
}
slice-translator-debugger .keys-toggle input { accent-color: var(--si-accent); }

slice-translator-debugger .count { font-size: 11px; color: var(--si-dim); white-space: nowrap; }
slice-translator-debugger .count span { color: var(--si-danger); font-weight: 600; }

slice-translator-debugger .translator-meta {
   padding: 8px 13px;
   border-bottom: 1px solid var(--si-border);
   color: var(--si-dim);
   font-size: 10.5px;
   letter-spacing: 0.02em;
}

slice-translator-debugger .translator-list {
   padding: 10px 12px 12px;
   overflow: auto;
   display: flex;
   flex-direction: column;
   gap: 7px;
}
slice-translator-debugger .translator-list::-webkit-scrollbar { width: 8px; }
slice-translator-debugger .translator-list::-webkit-scrollbar-thumb {
   background: var(--si-raised-2);
   border-radius: 8px;
   border: 2px solid transparent;
   background-clip: padding-box;
}

slice-translator-debugger .key-row {
   display: flex;
   align-items: center;
   gap: 8px;
   border: 1px solid var(--si-border);
   border-left: 2px solid transparent;
   border-radius: 9px;
   background: var(--si-raised);
   padding: 8px 10px;
   font-size: 11px;
}
slice-translator-debugger .key-row.missing { border-left-color: var(--si-danger); }
slice-translator-debugger .key-row.fallback { border-left-color: var(--si-success); }

slice-translator-debugger .key {
   color: var(--si-text);
   font-family: var(--si-mono);
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

slice-translator-debugger .where { color: var(--si-dim); font-size: 10px; }

slice-translator-debugger .tag {
   margin-left: auto;
   padding: 1px 7px;
   border-radius: 999px;
   font-size: 9.5px;
   letter-spacing: 0.05em;
   text-transform: uppercase;
   white-space: nowrap;
}
slice-translator-debugger .key-row.missing .tag {
   color: var(--si-danger);
   background: rgba(255, 107, 107, 0.12);
   border: 1px solid rgba(255, 107, 107, 0.28);
}
slice-translator-debugger .key-row.fallback .tag {
   color: var(--si-success);
   background: rgba(70, 211, 154, 0.12);
   border: 1px solid rgba(70, 211, 154, 0.28);
}

slice-translator-debugger .empty {
   color: var(--si-dim);
   font-size: 11px;
   letter-spacing: 0.04em;
   text-align: center;
   padding: 22px 0;
}

@media (prefers-reduced-motion: reduce) {
   slice-translator-debugger #translator-debugger.active { animation: none; }
   slice-translator-debugger .status-dot { animation: none; }
}
      `;
   }
}

customElements.define('slice-translator-debugger', TranslatorDebugger);
