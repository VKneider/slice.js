/**
 * EventManager - Sistema de eventos pub/sub para Slice.js
 * Ubicación: /Slice/Components/Structural/EventManager/EventManager.js
 *
 * Características:
 * - Suscripciones globales y vinculadas a componentes
 * - Auto-limpieza cuando componentes se destruyen
 * - API simple: subscribe, subscribeOnce, unsubscribe, emit
 */
/**
 * @typedef {Object} EventManagerBind
 * @property {(eventName: string, callback: Function) => string|null} subscribe
 * @property {(eventName: string, callback: Function) => string|null} subscribeOnce
 * @property {(eventName: string, data?: any) => void} emit
 */


export default class EventManager {
   constructor() {
      // Map<eventName, Map<subscriptionId, { callback, componentSliceId, once }>>
      this.subscriptions = new Map();

      // Map<sliceId, Set<{ eventName, subscriptionId }>> - Para auto-cleanup
      this.componentSubscriptions = new Map();

      // Ring buffer de últimos emits (max 500) — solo se llena cuando el debugger está abierto
      this.emitHistory = [];

      // Contador de emits por evento en la sesión actual de grabación
      this.emitCounts = new Map();

      // Atribución de emisores por evento (tracing): Map<eventName, Map<key, { sliceId?, name?, source?, count, lastTs }>>
      // Se llena solo mientras un debugger está abierto (igual que emitHistory).
      this.emitters = new Map();

      // Flag: solo grabamos cuando algún debugger UI está visible
      this._recording = false;

      // Contador para IDs únicos
      this.idCounter = 0;

      // ── Event registry (catálogo declarado vía register()) ──
      // Map<eventName, { description, payload }>
      this.registry = new Map();
      // Validación activa: se enciende al primer register(). En loose mode (sin
      // registry) NO se advierte nada — comportamiento idéntico al histórico.
      this._validating = false;
      // Warn-once: nombres ya advertidos como no declarados (evita spam).
      this.undeclaredSeen = new Set();
      // Drift para el debugger: eventos usados (emit/subscribe) pero no declarados.
      this.undeclared = new Set();
      // Warn-once: nombres ya advertidos por no tener namespace.
      this._noNamespaceSeen = new Set();

      // Grafo estático (documentación) generado por `slice types generate`:
      // { events: { name: { payload, emitters[], listeners[] } }, dynamic: {...} }.
      // Complementa el tracing observacional (this.emitters / this.emitHistory).
      this.graph = null;
   }

   init() {
      return true;
   }

   // ============================================
   // REGISTRY - Catálogo de eventos declarados
   // ============================================

   /**
    * Declarar un catálogo de eventos. Mergeable: se puede llamar varias veces
    * desde varios módulos. Enciende la validación dev (warn-on-undeclared).
    *
    * Dos formas:
    *  - register(catalog) con claves planas `'namespace:event'`.
    *  - register(namespace, catalog) que prefija cada clave con `namespace:`,
    *    para declarar un grupo sin repetir el prefijo.
    *
    * @param {string|Object<string, { description?: string, payload?: object|null }>} namespaceOrCatalog
    * @param {Object<string, { description?: string, payload?: object|null }>} [maybeCatalog]
    * @returns {EventManager} this (encadenable)
    *
    * @example
    * slice.events.register({
    *    'user:login':  { description: 'User logged in', payload: { id: 'number', name: 'string' } },
    *    'cart:cleared': { description: 'Cart emptied', payload: null },
    * });
    *
    * @example
    * // Agrupado por namespace
    * slice.events.register('user', {
    *    login:  { payload: { id: 'number', name: 'string' } },
    *    logout: { payload: null },
    * }); // => 'user:login', 'user:logout'
    */
   register(namespaceOrCatalog, maybeCatalog) {
      let prefix = '';
      let catalog = namespaceOrCatalog;

      if (typeof namespaceOrCatalog === 'string') {
         const ns = namespaceOrCatalog.trim();
         prefix = ns.endsWith(':') ? ns : `${ns}:`;
         catalog = maybeCatalog;
      }

      if (!catalog || typeof catalog !== 'object') {
         slice.logger.logError('EventManager', 'register() requiere un objeto catálogo de eventos');
         return this;
      }

      // Al primer register() sembramos los eventos internos del framework para
      // que nunca disparen falsos warnings, y activamos la validación.
      if (!this._validating) {
         this._seedFrameworkEvents();
         this._validating = true;
      }

      for (const [key, definition] of Object.entries(catalog)) {
         const eventName = `${prefix}${key}`;
         this._warnIfNoNamespace(eventName);

         const entry = {
            description: definition?.description || '',
            payload: definition?.payload ?? null,
         };

         const existing = this.registry.get(eventName);
         if (existing && JSON.stringify(existing.payload) !== JSON.stringify(entry.payload)) {
            slice.logger.logWarning(
               'EventManager',
               `Evento "${eventName}" redeclarado con un payload distinto; se usa la última definición`
            );
         }

         this.registry.set(eventName, entry);
         // Si estaba marcado como drift, ya no lo está.
         this.undeclared.delete(eventName);
         this.undeclaredSeen.delete(eventName);
      }

      return this;
   }

   /**
    * Cargar el grafo estático de eventos (manifest generado por el CLI). Es la capa
    * de DOCUMENTACIÓN (emisores/oyentes por análisis de código, sin ejecutar), que
    * complementa el tracing observacional en runtime.
    * @param {{ events: object, dynamic?: object }} graph
    * @returns {EventManager} this
    */
   loadGraph(graph) {
      if (graph && typeof graph === 'object' && graph.events) {
         this.graph = graph;
      }
      return this;
   }

   /**
    * Emisores conocidos de un evento por análisis estático (documentación).
    * @param {string} eventName
    * @returns {Array<{ file: string, line: number, component: string|null }>}
    */
   staticEmittersOf(eventName) {
      return this.graph?.events?.[eventName]?.emitters || [];
   }

   /**
    * Oyentes conocidos de un evento por análisis estático (documentación).
    * @param {string} eventName
    * @returns {Array<{ file: string, line: number, component: string|null }>}
    */
   staticListenersOf(eventName) {
      return this.graph?.events?.[eventName]?.listeners || [];
   }

   /**
    * Namespace de un evento: el segmento antes del primer ':' (o null si no tiene).
    * @param {string} eventName
    * @returns {string|null}
    */
   namespaceOf(eventName) {
      const index = typeof eventName === 'string' ? eventName.indexOf(':') : -1;
      return index > 0 ? eventName.slice(0, index) : null;
   }

   /**
    * Sembrar los eventos internos del framework en el registry.
    * @private
    */
   _seedFrameworkEvents() {
      const framework = {
         'router:change': { description: 'Router navigated to a new route', payload: null },
         'context:__created': { description: 'A context was created', payload: { name: 'string', state: 'object' } },
      };
      for (const [name, def] of Object.entries(framework)) {
         if (!this.registry.has(name)) this.registry.set(name, def);
      }
   }

   /**
    * ¿El evento está declarado en el registry?
    * @param {string} eventName
    * @returns {boolean}
    */
   isDeclared(eventName) {
      if (this.registry.has(eventName)) return true;
      // Familia dinámica context:<name> emitida por el ContextManager.
      if (eventName.startsWith('context:')) return true;
      return false;
   }

   /**
    * Advertir (una sola vez, solo en dev) si el evento no está declarado.
    * @private
    */
   _warnIfUndeclared(eventName) {
      if (!this._validating) return;
      if (this.isDeclared(eventName)) return;

      this.undeclared.add(eventName);
      if (this.undeclaredSeen.has(eventName)) return;
      this.undeclaredSeen.add(eventName);

      if (!slice.isProduction || !slice.isProduction()) {
         slice.logger.logWarning(
            'EventManager',
            `Undeclared event "${eventName}" — register it via slice.events.register({ '${eventName}': { payload: ... } })`
         );
      }
   }

   /**
    * Advertir (una sola vez, solo en dev) si el evento no tiene namespace.
    * Solo activo cuando hay un registry en uso (this._validating).
    * @private
    */
   _warnIfNoNamespace(eventName) {
      if (!this._validating) return;
      if (typeof eventName !== 'string' || eventName.includes(':')) return;
      if (this._noNamespaceSeen.has(eventName)) return;
      this._noNamespaceSeen.add(eventName);

      if (!slice.isProduction || !slice.isProduction()) {
         slice.logger.logWarning(
            'EventManager',
            `Event "${eventName}" has no namespace — prefer "namespace:${eventName}" (e.g. group it with slice.events.register('app', { ${eventName}: ... })).`
         );
      }
   }

   // ============================================
   // API PRINCIPAL
   // ============================================

   /**
    * Suscribirse a un evento
    * @param {string} eventName - Nombre del evento
    * @param {(data?: any) => void} callback - Funcion a ejecutar cuando se emita el evento
    * @param {{ component?: HTMLElement }} [options]
    * @returns {string|null} subscriptionId - ID para desuscribirse
    *
    * @example
    * // Suscripcion global
    * const id = slice.events.subscribe('user:login', (user) => {
    *    console.log('Usuario:', user);
    * });
    *
    * // Suscripcion con auto-cleanup
    * slice.events.subscribe('user:login', (user) => {
    *    this.actualizar(user);
    * }, { component: this });
    */
   subscribe(eventName, callback, options = {}) {
      if (typeof callback !== 'function') {
         slice.logger.logError('EventManager', 'El callback debe ser una función');
         return null;
      }

      this._warnIfUndeclared(eventName);
      this._warnIfNoNamespace(eventName);

      const subscriptionId = `evt_${++this.idCounter}`;

      // Crear Map para este evento si no existe
      if (!this.subscriptions.has(eventName)) {
         this.subscriptions.set(eventName, new Map());
      }

      // Guardar la suscripción
      this.subscriptions.get(eventName).set(subscriptionId, {
         callback,
         componentSliceId: options.component?.sliceId || null,
         once: false,
      });

      // Si hay componente, registrar para auto-cleanup
      if (options.component?.sliceId) {
         this._registerComponentSubscription(options.component.sliceId, eventName, subscriptionId);
      }

      slice.logger.logInfo('EventManager', `Suscrito a "${eventName}" [${subscriptionId}]`);

      return subscriptionId;
   }

   /**
    * Suscribirse a un evento una sola vez
    * @param {string} eventName - Nombre del evento
    * @param {(data?: any) => void} callback - Funcion a ejecutar
    * @param {{ component?: HTMLElement }} [options]
    * @returns {string|null} subscriptionId
    *
    * @example
    * slice.events.subscribeOnce('app:ready', () => {
    *    console.log('App lista!');
    * });
    */
   /**
    * Activar registro de emits (lo llama el debugger al abrirse).
    */
   startRecording() {
      this._recording = true;
      this.emitHistory = [];
      this.emitCounts = new Map();
      this.emitters = new Map();
   }

   /**
    * Desactivar registro de emits (lo llama el debugger al cerrarse).
    */
   stopRecording() {
      this._recording = false;
   }

   subscribeOnce(eventName, callback, options = {}) {
      if (typeof callback !== 'function') {
         slice.logger.logError('EventManager', 'El callback debe ser una función');
         return null;
      }

      this._warnIfUndeclared(eventName);
      this._warnIfNoNamespace(eventName);

      const subscriptionId = `evt_${++this.idCounter}`;

      if (!this.subscriptions.has(eventName)) {
         this.subscriptions.set(eventName, new Map());
      }

      this.subscriptions.get(eventName).set(subscriptionId, {
         callback,
         componentSliceId: options.component?.sliceId || null,
         once: true,
      });

      if (options.component?.sliceId) {
         this._registerComponentSubscription(options.component.sliceId, eventName, subscriptionId);
      }

      slice.logger.logInfo('EventManager', `Suscrito (once) a "${eventName}" [${subscriptionId}]`);

      return subscriptionId;
   }

   /**
    * Desuscribirse de un evento
    * @param {string} eventName - Nombre del evento
    * @param {string} subscriptionId - ID de la suscripcion
    * @returns {boolean} true si se elimino correctamente
    *
    * @example
    * const id = slice.events.subscribe('evento', callback);
    * // Despues...
    * slice.events.unsubscribe('evento', id);
    */
   unsubscribe(eventName, subscriptionId) {
      if (!this.subscriptions.has(eventName)) {
         return false;
      }

      const removed = this.subscriptions.get(eventName).delete(subscriptionId);

      // Limpiar Map vacío
      if (this.subscriptions.get(eventName).size === 0) {
         this.subscriptions.delete(eventName);
      }

      if (removed) {
         slice.logger.logInfo('EventManager', `Desuscrito de "${eventName}" [${subscriptionId}]`);
      }

      return removed;
   }

   /**
    * Emitir un evento
    * @param {string} eventName - Nombre del evento
    * @param {any} [data] - Datos a pasar a los callbacks
    * @returns {void}
    *
    * @example
    * slice.events.emit('user:login', { id: 123, name: 'Juan' });
    * slice.events.emit('cart:cleared'); // Sin datos
    */
   emit(eventName, ...args) {
      // Global (unbound) emit — emitter resolved best-effort from the call stack.
      this._emitFrom(null, eventName, args);
   }

   /**
    * Core emit. `emitter` is the known source ({ sliceId, name }) when emitted via
    * a bound API, or null for global emits (then a dev stack-trace fallback runs).
    * @param {{ sliceId?: string, name?: string }|null} emitter
    * @param {string} eventName
    * @param {any[]} args
    * @private
    */
   _emitFrom(emitter, eventName, args) {
      slice.logger.info('EventManager', `Emitting "${eventName}"`, args[0] ?? null);

      this._warnIfUndeclared(eventName);
      this._warnIfNoNamespace(eventName);

      // Solo grabamos el histórico (y la atribución de emisores) si algún debugger está abierto.
      if (this._recording) {
         const source = emitter || this._captureEmitterSource();
         this.emitHistory.push({ eventName, timestamp: Date.now(), emitter: source });
         if (this.emitHistory.length > 500) this.emitHistory.shift();
         this.emitCounts.set(eventName, (this.emitCounts.get(eventName) || 0) + 1);
         this._recordEmitter(eventName, source);
      }

      if (!this.subscriptions.has(eventName)) {
         return;
      }

      const toRemove = [];

      for (const [subscriptionId, subscription] of this.subscriptions.get(eventName)) {
         if (subscription.componentSliceId) {
            if (!slice.controller.activeComponents.has(subscription.componentSliceId)) {
               toRemove.push(subscriptionId);
               continue;
            }
         }

         try {
            subscription.callback(...args);
         } catch (error) {
            slice.logger.error('EventManager', `Error in callback for "${eventName}" [${subscriptionId}]`, error);
         }

         // Si es subscribeOnce, marcar para eliminar
         if (subscription.once) {
            toRemove.push(subscriptionId);
         }
      }

      // Limpiar suscripciones marcadas
      toRemove.forEach((id) => {
         this.subscriptions.get(eventName).delete(id);
      });

      // Limpiar Map vacío
      if (this.subscriptions.get(eventName).size === 0) {
         this.subscriptions.delete(eventName);
      }
   }

   /**
    * Aggregate an emitter under an event: who emits, with a count. Powers the
    * "emitted by" tracing view in the debugger.
    * @param {{ sliceId?: string, name?: string, source?: string }|null} emitter
    * @private
    */
   _recordEmitter(eventName, emitter) {
      if (!emitter) return;
      const key = emitter.sliceId || emitter.source || 'unknown';
      if (!this.emitters.has(eventName)) this.emitters.set(eventName, new Map());
      const bucket = this.emitters.get(eventName);
      const existing = bucket.get(key);
      if (existing) {
         existing.count += 1;
         existing.lastTs = Date.now();
      } else {
         bucket.set(key, { ...emitter, count: 1, lastTs: Date.now() });
      }
   }

   /**
    * Best-effort source of a global emit from the call stack (dev only). Returns
    * { source: 'file.js:line' } or null. Robust: never throws, never runs in prod.
    * @private
    */
   _captureEmitterSource() {
      if (slice.isProduction && slice.isProduction()) return null;
      try {
         const stack = new Error().stack || '';
         for (const line of stack.split('\n')) {
            // Skip the Error header and every frame inside this manager.
            if (line.includes('EventManager.js')) continue;
            const match = line.match(/([^/\\\s(]+\.js):(\d+):\d+/);
            if (match) return { source: `${match[1]}:${match[2]}` };
         }
      } catch {
         /* tracing is best-effort */
      }
      return null;
   }

   // ============================================
   // BIND - Vinculación a Componente
   // ============================================

   /**
    * Vincular el EventManager a un componente para auto-cleanup
    * @param {HTMLElement} component - Componente Slice con sliceId
    * @returns {EventManagerBind|null} API vinculada al componente
    *
    * @example
    * class MiComponente extends HTMLElement {
    *    async init() {
    *       this.events = slice.events.bind(this);
    *
    *       this.events.subscribe('user:login', (user) => {
    *          this.actualizar(user);
    *       });
    *    }
    * }
    */
   bind(component) {
      if (!component?.sliceId) {
         slice.logger.logError('EventManager', 'bind() requiere un componente Slice válido con sliceId');
         return null;
      }

      const self = this;

      return {
         /**
          * Suscribirse a un evento (auto-cleanup)
          */
         subscribe: (eventName, callback) => {
            return self.subscribe(eventName, callback, { component });
         },

         /**
          * Suscribirse una sola vez (auto-cleanup)
          */
         subscribeOnce: (eventName, callback) => {
            return self.subscribeOnce(eventName, callback, { component });
         },

         /**
          * Emitir un evento (atribuido a este componente para el tracing).
          */
         emit: (eventName, data) => {
            self._emitFrom(
               { sliceId: component.sliceId, name: component.constructor?.name || 'Component' },
               eventName,
               [data]
            );
         },

         /**
          * Declarar eventos en el registry (passthrough a register()).
          */
         register: (namespaceOrCatalog, maybeCatalog) => {
            self.register(namespaceOrCatalog, maybeCatalog);
            return self;
         },
      };
   }

   // ============================================
   // AUTO-CLEANUP
   // ============================================

   /**
    * Registrar suscripción para un componente (interno)
    */
   _registerComponentSubscription(sliceId, eventName, subscriptionId) {
      if (!this.componentSubscriptions.has(sliceId)) {
         this.componentSubscriptions.set(sliceId, new Set());
      }
      this.componentSubscriptions.get(sliceId).add({ eventName, subscriptionId });
   }

   /**
    * Limpiar todas las suscripciones de un componente
    * Se llama automáticamente cuando el componente se destruye
    * @param {string} sliceId - ID del componente
    * @returns {number} Cantidad de suscripciones eliminadas
    */
   cleanupComponent(sliceId) {
      if (!this.componentSubscriptions.has(sliceId)) {
         return 0;
      }

      const subscriptions = this.componentSubscriptions.get(sliceId);
      let count = 0;

      for (const { eventName, subscriptionId } of subscriptions) {
         if (this.unsubscribe(eventName, subscriptionId)) {
            count++;
         }
      }

      this.componentSubscriptions.delete(sliceId);

      if (count > 0) {
         slice.logger.logInfo('EventManager', `Limpiadas ${count} suscripción(es) de ${sliceId}`);
      }

      return count;
   }

   // ============================================
   // UTILIDADES
   // ============================================

   /**
    * Verificar si hay suscriptores para un evento
    * @param {string} eventName - Nombre del evento
    * @returns {boolean}
    */
   hasSubscribers(eventName) {
      return this.subscriptions.has(eventName) && this.subscriptions.get(eventName).size > 0;
   }

   /**
    * Obtener cantidad de suscriptores para un evento
    * @param {string} eventName - Nombre del evento
    * @returns {number}
    */
   subscriberCount(eventName) {
      if (!this.subscriptions.has(eventName)) {
         return 0;
      }
      return this.subscriptions.get(eventName).size;
   }

   /**
    * Limpiar TODAS las suscripciones (usar con cuidado)
    */
   clear() {
      this.subscriptions.clear();
      this.componentSubscriptions.clear();
      this.idCounter = 0;
      slice.logger.logInfo('EventManager', 'Todas las suscripciones eliminadas');
   }
}
