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

      // Flag: solo grabamos cuando algún debugger UI está visible
      this._recording = false;

      // Contador para IDs únicos
      this.idCounter = 0;
   }

   init() {
      return true;
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
      slice.logger.info('EventManager', `Emitting "${eventName}"`, args[0] ?? null);

      // Solo grabamos el histórico si algún debugger está abierto
      if (this._recording) {
         this.emitHistory.push({ eventName, timestamp: Date.now() });
         if (this.emitHistory.length > 500) this.emitHistory.shift();
         this.emitCounts.set(eventName, (this.emitCounts.get(eventName) || 0) + 1);
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
          * Emitir un evento
          */
         emit: (eventName, data) => {
            self.emit(eventName, data);
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
