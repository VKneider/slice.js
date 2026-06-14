const LV_LOG_TYPES = ['error', 'warn', 'info', 'debug'];

const LV_BADGE_LABEL = { error: 'ERR', warn: 'WRN', info: 'INF', debug: 'DBG' };

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return '&#39;';
  });
}

export default class LogViewer extends HTMLElement {
  constructor() {
    super();

    slice.stylesManager.registerComponentStyles('LogViewer', productionOnlyCSS());
    this.innerHTML = productionOnlyHtml();

    this.$header = this.querySelector('.lv__header');
    this.$body = this.querySelector('[data-body]');
    this.$count = this.querySelector('[data-count]');

    this._isOpen = false;
    this._logCount = 0;
    this._filters = new Set();
    this._dragState = null;
    this._logHandler = null;
  }

  init() {
    this._attachDrag();
    this._attachFilterClicks();
    this._attachClear();
    this._attachMinimize();
    this._attachBodyClick();
    this._render();
    this._subscribeLogger();
  }

  toggle() {
    this._isOpen = !this._isOpen;
    this.style.display = this._isOpen ? '' : 'none';
    if (this._isOpen) this._render();
    return this._isOpen;
  }

  _detach() {
    this._unsubscribeLogger();
    if (this._dragCleanup) this._dragCleanup();
  }

  /* -- drag -- */
  _attachDrag() {
    const header = this.$header;
    if (!header) return;

    const onDown = (e) => {
      if (e.target.closest('button')) return;
      this._dragState = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: this.offsetLeft,
        origTop: this.offsetTop,
        origRight: this.style.right,
        origBottom: this.style.bottom
      };
      this.style.right = 'auto';
      this.style.bottom = 'auto';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    const onMove = (e) => {
      if (!this._dragState) return;
      const dx = e.clientX - this._dragState.startX;
      const dy = e.clientY - this._dragState.startY;
      this.style.left = (this._dragState.origLeft + dx) + 'px';
      this.style.top = (this._dragState.origTop + dy) + 'px';
    };

    const onUp = () => {
      this._dragState = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    header.addEventListener('mousedown', onDown);
    this._dragCleanup = () => {
      header.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }

  /* -- filter buttons -- */
  _attachFilterClicks() {
    const btns = this.querySelectorAll('.lv__filter');
    for (const btn of btns) {
      btn.addEventListener('click', () => {
        const type = btn.dataset.filter;
        if (btn.hasAttribute('data-active')) {
          btn.removeAttribute('data-active');
          this._filters.delete(type);
        } else {
          btn.setAttribute('data-active', '');
          this._filters.add(type);
        }
        this._render();
      });
    }
  }

  /* -- clear -- */
  _attachClear() {
    const btn = this.querySelector('.lv__clear');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (slice.logger) slice.logger.logs = [];
      this._logCount = 0;
      this._render();
    });
  }

  /* -- minimize -- */
  _attachMinimize() {
    const btn = this.querySelector('.lv__close');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (this.hasAttribute('data-minimized')) {
        this.removeAttribute('data-minimized');
        btn.textContent = '\u00d7';
      } else {
        this.setAttribute('data-minimized', '');
        btn.textContent = '\u25a1';
      }
    });
  }

  /* -- expand error detail on click -- */
  _attachBodyClick() {
    if (!this.$body) return;
    this.$body.addEventListener('click', (e) => {
      const entry = e.target.closest('.lv__entry');
      if (!entry) return;
      const hasErr = entry.querySelector('.lv__entry-error');
      if (!hasErr) return;
      entry.toggleAttribute('data-expanded');
    });
  }

  /* -- real-time subscription via logger.onLog -- */
  _subscribeLogger() {
    const logger = slice.logger;
    if (!logger || typeof logger.onLog !== 'function') return;
    this._logHandler = logger.onLog(() => {
      this._render();
    });
  }

  _unsubscribeLogger() {
    const logger = slice.logger;
    if (!logger || typeof logger.offLog !== 'function') return;
    if (this._logHandler) {
      logger.offLog(this._logHandler);
      this._logHandler = null;
    }
  }

  /* -- render -- */
  _render() {
    const logger = slice.logger;
    if (!logger || !logger.logs) return;
    const logs = logger.logs;
    this._logCount = logs.length;

    const filters = this._filters;
    const hasFilters = filters.size > 0;

    if (this.$count) {
      this.$count.textContent = logs.length;
    }

    if (!this.$body) return;

    if (logs.length === 0) {
      this.$body.innerHTML = '<div class="lv__empty"><span class="lv__empty-icon">&#128225;</span><span>No logs yet</span></div>';
      return;
    }

    const filtered = hasFilters ? logs.filter((log) => filters.has(log.logType)) : logs;
    const reversed = [...filtered].reverse();

    let html = '';
    for (const log of reversed) {
      const type = log.logType || 'info';
      const ts = formatTime(log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp));
      const badge = LV_BADGE_LABEL[type] || 'INF';
      const component = escapeHtml(log.componentSliceId || '');
      const msg = escapeHtml(log.message || '');

      let errHtml = '';
      if (log.error) {
        const stack = log.error.stack || String(log.error);
        errHtml = `<div class="lv__entry-error">${escapeHtml(stack)}</div>`;
      }

      html += `<div class="lv__entry lv__entry--${type}">
        <span class="lv__entry-time">${ts}</span>
        <span class="lv__entry-badge">${badge}</span>
        <div class="lv__entry-body">
          <div class="lv__entry-component">${component}</div>
          <div class="lv__entry-message">${msg}</div>
          ${errHtml}
        </div>
      </div>`;
    }

    this.$body.innerHTML = html;
    if (this.$body.scrollTop < 20) {
      this.$body.scrollTop = 0;
    }
  }
}

customElements.define('slice-log-viewer', LogViewer);

function productionOnlyCSS() {
  return `/* ── LogViewer (Structural) ── */
slice-log-viewer {
  position: fixed;
  z-index: 2147483647;
  bottom: 24px;
  right: 24px;
  width: 520px;
  max-width: calc(100vw - 48px);
  height: 380px;
  max-height: calc(100vh - 48px);
  display: block;
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid color-mix(in srgb, var(--medium-color, #555) 60%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary-background-color, #1e1e2e) 97%, #000);
  box-shadow: 0 12px 48px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.08);
  overflow: hidden;
  user-select: none;
  resize: both;
  min-width: 280px;
  min-height: 200px;
  transition: opacity .18s ease, transform .18s ease;
}

slice-log-viewer[data-minimized] {
  height: auto !important;
  resize: none;
  min-height: 0;
}

slice-log-viewer[data-minimized] .lv__body {
  display: none;
}

.lv__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 8px 14px;
  background: color-mix(in srgb, var(--tertiary-background-color, #2a2a3e) 80%, #000);
  border-bottom: 1px solid color-mix(in srgb, var(--medium-color, #555) 40%, transparent);
  cursor: grab;
  position: relative;
  z-index: 1;
}

.lv__header:active { cursor: grabbing; }

.lv__header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.lv__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .02em;
  color: var(--font-primary-color, #cdd6f4);
  white-space: nowrap;
}

.lv__count {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--medium-color, #555) 40%, transparent);
  color: var(--font-secondary-color, #a6adc8);
  font-variant-numeric: tabular-nums;
}

.lv__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.lv__filter,
.lv__clear,
.lv__close {
  all: unset;
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 6px;
  color: var(--font-secondary-color, #a6adc8);
  background: color-mix(in srgb, var(--medium-color, #555) 25%, transparent);
  transition: background .12s ease, color .12s ease;
  font-family: inherit;
  line-height: 1.4;
}

.lv__filter:hover,
.lv__clear:hover,
.lv__close:hover {
  background: color-mix(in srgb, var(--medium-color, #555) 45%, transparent);
  color: var(--font-primary-color, #cdd6f4);
}

.lv__filter[data-active] { color: #fff; }

.lv__filter[data-active][data-filter="error"] {
  background: #f38ba8;
  color: #1e1e2e;
}

.lv__filter[data-active][data-filter="warn"] {
  background: #f9e2af;
  color: #1e1e2e;
}

.lv__filter[data-active][data-filter="info"] {
  background: #89dceb;
  color: #1e1e2e;
}

.lv__filter[data-active][data-filter="debug"] {
  background: #a6adc8;
  color: #1e1e2e;
}

.lv__clear { margin-left: 2px; }

.lv__close {
  font-size: 16px;
  line-height: 1;
  padding: 3px 8px 4px;
}

.lv__body {
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100% - 38px);
  padding: 4px 0;
  cursor: auto;
}

.lv__body::-webkit-scrollbar { width: 5px; }
.lv__body::-webkit-scrollbar-track { background: transparent; }
.lv__body::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--medium-color, #555) 40%, transparent);
  border-radius: 3px;
}

.lv__entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--medium-color, #555) 12%, transparent);
  transition: background .1s ease;
  cursor: pointer;
}

.lv__entry:hover {
  background: color-mix(in srgb, var(--medium-color, #555) 8%, transparent);
}

.lv__entry:last-child { border-bottom: none; }

.lv__entry-time {
  font-size: 10px;
  color: color-mix(in srgb, var(--font-secondary-color, #a6adc8) 55%, transparent);
  white-space: nowrap;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}

.lv__entry-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: .04em;
  flex-shrink: 0;
  margin-top: 1px;
}

.lv__entry--error .lv__entry-badge {
  background: #f38ba8;
  color: #1e1e2e;
}

.lv__entry--warn .lv__entry-badge {
  background: #f9e2af;
  color: #1e1e2e;
}

.lv__entry--info .lv__entry-badge {
  background: #89dceb;
  color: #1e1e2e;
}

.lv__entry--debug .lv__entry-badge {
  background: color-mix(in srgb, var(--medium-color, #555) 40%, transparent);
  color: var(--font-secondary-color, #a6adc8);
}

.lv__entry-body {
  flex: 1;
  min-width: 0;
}

.lv__entry-component {
  font-size: 10px;
  font-weight: 600;
  color: var(--font-primary-color, #cdd6f4);
  margin-bottom: 1px;
}

.lv__entry-message {
  font-size: 11px;
  color: var(--font-secondary-color, #a6adc8);
  word-break: break-word;
  line-height: 1.45;
}

.lv__entry--error .lv__entry-message { color: #f38ba8; }
.lv__entry--warn .lv__entry-message { color: #f9e2af; }

.lv__entry-error {
  display: none;
  margin-top: 5px;
  padding: 6px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary-background-color, #1e1e2e) 60%, #000);
  font-size: 10px;
  color: color-mix(in srgb, var(--font-secondary-color, #a6adc8) 80%, transparent);
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  line-height: 1.5;
  max-height: 180px;
  overflow-y: auto;
}

.lv__entry[data-expanded] .lv__entry-error { display: block; }

.lv__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 6px;
  color: color-mix(in srgb, var(--font-secondary-color, #a6adc8) 40%, transparent);
  font-size: 12px;
}

.lv__empty-icon {
  font-size: 24px;
  opacity: .35;
  line-height: 1;
}
`;
}

function productionOnlyHtml() {
  return `<div class="lv">
  <div class="lv__header">
    <div class="lv__header-left">
      <span class="lv__title">Log Console</span>
      <span class="lv__count" data-count></span>
    </div>
    <div class="lv__header-actions">
      <button class="lv__filter" data-filter="error" title="Show errors only">Error</button>
      <button class="lv__filter" data-filter="warn" title="Show warnings only">Warn</button>
      <button class="lv__filter" data-filter="info" title="Show info only">Info</button>
      <button class="lv__filter" data-filter="debug" title="Show debug only">Debug</button>
      <button class="lv__clear" title="Clear all logs">Clear</button>
      <button class="lv__close" title="Close">&times;</button>
    </div>
  </div>
  <div class="lv__body" data-body></div>
</div>`;
}
