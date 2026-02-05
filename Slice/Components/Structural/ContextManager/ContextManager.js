/**
 * ContextManager - Sistema de contextos compartidos para Slice.js
 * Ubicación: /Slice/Components/Structural/ContextManager/ContextManager.js
 *
 * Características:
 * - Estado compartido entre componentes
 * - Usa EventManager internamente para notificaciones
 * - Selectores para observar campos específicos
 * - Auto-limpieza cuando componentes se destruyen
 * - Persistencia opcional en localStorage
 */
/**
 * @typedef {Object} ContextOptions
 * @property {boolean} [persist]
 * @property {string} [storageKey]
 */

export default class ContextManager {
   constructor() {
      // Map<contextName, { state, options }>
      this.contexts = new Map();
   }

   init() {
      return true;
   }

   // ============================================
   // CREAR CONTEXTO
   // ============================================

   /**
    * Crear un nuevo contexto
    * @param {string} name - Nombre unico del contexto
    * @param {Object} [initialState] - Estado inicial
    * @param {ContextOptions} [options] - Opciones: { persist, storageKey }
    * @returns {boolean}
    *
    * @example
    * slice.context.create('auth', {
    *    isLoggedIn: false,
    *    user: null
    * });
    *
    * // Con persistencia en localStorage
    * slice.context.create('preferences', {
    *    theme: 'light',
    *    language: 'es'
    * }, { persist: true });
    */
   create(name, initialState = {}, options = {}) {
      if (this.contexts.has(name)) {
         slice.logger.logWarning('ContextManager', `El contexto "${name}" ya existe`);
         return false;
      }

      // Cargar estado persistido si existe
      let state = initialState;
      if (options.persist) {
         const persisted = this._loadFromStorage(name);
         if (persisted !== null) {
            state = persisted;
         }
      }

      this.contexts.set(name, {
         state,
         options: {
            persist: options.persist || false,
            storageKey: options.storageKey || `slice_context_${name}`,
         },
      });

      slice.logger.logInfo('ContextManager', `Contexto "${name}" creado`);

      return true;
   }

   // ============================================
   // LEER ESTADO
   // ============================================

   /**
    * Obtener el estado actual de un contexto
    * @param {string} name - Nombre del contexto
    * @returns {any|null} Estado actual o null si no existe
    *
    * @example
    * const auth = slice.context.getState('auth');
    * console.log(auth.user.name);
    */
   getState(name) {
      if (!this.contexts.has(name)) {
         slice.logger.logError('ContextManager', `El contexto "${name}" no existe`);
         return null;
      }

      return this.contexts.get(name).state;
   }

   // ============================================
   // ACTUALIZAR ESTADO
   // ============================================

   /**
    * Actualizar el estado de un contexto
    * @param {string} name - Nombre del contexto
    * @param {Object|Function} updater - Nuevo estado o funcion (prevState) => newState
    * @returns {void}
    *
    * @example
    * // Reemplazar con objeto
    * slice.context.setState('auth', {
    *    isLoggedIn: true,
    *    user: { name: 'Juan' }
    * });
    *
    * // Usar funcion para acceder al estado anterior
    * slice.context.setState('cart', (prev) => ({
    *    ...prev,
    *    items: [...prev.items, nuevoProducto],
    *    total: prev.total + nuevoProducto.price
    * }));
    */
   setState(name, updater) {
      if (!this.contexts.has(name)) {
         slice.logger.logError('ContextManager', `El contexto "${name}" no existe`);
         return;
      }

      const context = this.contexts.get(name);
      const prevState = context.state;

      // Calcular nuevo estado
      let newState;
      if (typeof updater === 'function') {
         newState = updater(prevState);
      } else {
         newState = updater;
      }

      // Guardar nuevo estado
      context.state = newState;

      // Persistir si está habilitado
      if (context.options.persist) {
         this._saveToStorage(name, newState, context.options.storageKey);
      }

      // Emitir evento para notificar a los watchers
      slice.events.emit(`context:${name}`, newState, prevState);

      slice.logger.logInfo('ContextManager', `Contexto "${name}" actualizado`);
   }

   // ============================================
   // WATCH (OBSERVAR CAMBIOS)
   // ============================================

   /**
    * Observar cambios en un contexto
    * @param {string} name - Nombre del contexto
    * @param {HTMLElement} component - Componente Slice para auto-cleanup
    * @param {(value: any) => void} callback - Funcion a ejecutar cuando cambia
    * @param {(state: any) => any} [selector] - Opcional. Funcion para seleccionar campos
    * @returns {string|null} subscriptionId
    *
    * @example
    * // Observar todo el estado
    * slice.context.watch('auth', this, (state) => {
    *    this.render(state);
    * });
    *
    * // Observar un campo especifico
    * slice.context.watch('auth', this, (name) => {
    *    this.$name.textContent = name;
    * }, state => state.user.name);
    *
    * // Observar multiples campos
    * slice.context.watch('auth', this, (data) => {
    *    this.$name.textContent = data.name;
    *    this.$avatar.src = data.avatar;
    * }, state => ({
    *    name: state.user.name,
    *    avatar: state.user.avatar
    * }));
    *
    * // Valores computados
    * slice.context.watch('cart', this, (total) => {
    *    this.$total.textContent = `${total}`;
    * }, state => state.items.reduce((sum, i) => sum + i.price, 0));
    */
   watch(name, component, callback, selector = null) {
      if (!this.contexts.has(name)) {
         slice.logger.logError('ContextManager', `El contexto "${name}" no existe`);
         return null;
      }

      if (!component?.sliceId) {
         slice.logger.logError('ContextManager', 'watch() requiere un componente Slice válido');
         return null;
      }

      if (typeof callback !== 'function') {
         slice.logger.logError('ContextManager', 'El callback debe ser una función');
         return null;
      }

      // Guardar el valor anterior del selector para comparar
      let lastSelectedValue = selector ? this._getSelectedValue(name, selector) : this.getState(name);

      // Crear wrapper que aplica el selector y compara
      const wrappedCallback = (newState, prevState) => {
         if (selector) {
            const newSelectedValue = this._applySelector(newState, selector);
            const prevSelectedValue = this._applySelector(prevState, selector);

            // Solo ejecutar si el valor seleccionado cambió
            if (!this._isEqual(newSelectedValue, prevSelectedValue)) {
               lastSelectedValue = newSelectedValue;
               callback(newSelectedValue);
            }
         } else {
            // Sin selector, siempre ejecutar
            callback(newState);
         }
      };

      // Suscribirse al evento del contexto
      const subscriptionId = slice.events.subscribe(`context:${name}`, wrappedCallback, { component });

      slice.logger.logInfo('ContextManager', `Watch registrado en "${name}" para ${component.sliceId}`);

      return subscriptionId;
   }

   // ============================================
   // UTILIDADES
   // ============================================

   /**
    * Verificar si un contexto existe
    * @param {string} name - Nombre del contexto
    * @returns {boolean}
    */
   has(name) {
      return this.contexts.has(name);
   }

   /**
    * Eliminar un contexto
    * @param {string} name - Nombre del contexto
    * @returns {boolean}
    */
   destroy(name) {
      if (!this.contexts.has(name)) {
         return false;
      }

      const context = this.contexts.get(name);

      // Limpiar storage si existe
      if (context.options.persist) {
         this._removeFromStorage(context.options.storageKey);
      }

      this.contexts.delete(name);

      slice.logger.logInfo('ContextManager', `Contexto "${name}" eliminado`);

      return true;
   }

   /**
    * Obtener lista de todos los contextos
    * @returns {string[]}
    */
   list() {
      return Array.from(this.contexts.keys());
   }

   // ============================================
   // MÉTODOS PRIVADOS
   // ============================================

   /**
    * Aplicar selector al estado
    */
   _applySelector(state, selector) {
      try {
         return selector(state);
      } catch (error) {
         slice.logger.logWarning('ContextManager', 'Error al aplicar selector', error);
         return undefined;
      }
   }

   /**
    * Obtener valor seleccionado del estado actual
    */
   _getSelectedValue(name, selector) {
      const state = this.getState(name);
      return this._applySelector(state, selector);
   }

   /**
    * Comparar dos valores (shallow)
    */
   _isEqual(a, b) {
      // Mismo valor primitivo o referencia
      if (a === b) return true;

      // Si alguno es null/undefined
      if (a == null || b == null) return false;

      // Si no son objetos, ya sabemos que son diferentes
      if (typeof a !== 'object' || typeof b !== 'object') return false;

      // Comparación shallow de objetos
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
         if (a[key] !== b[key]) return false;
      }

      return true;
   }

   /**
    * Cargar estado desde localStorage
    */
   _loadFromStorage(name) {
      try {
         const key = `slice_context_${name}`;
         const data = localStorage.getItem(key);
         if (data) {
            return JSON.parse(data);
         }
      } catch (error) {
         slice.logger.logWarning('ContextManager', `Error cargando "${name}" de localStorage`, error);
      }
      return null;
   }

   /**
    * Guardar estado en localStorage
    */
   _saveToStorage(name, state, storageKey) {
      try {
         localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (error) {
         slice.logger.logWarning('ContextManager', `Error guardando "${name}" en localStorage`, error);
      }
   }

   /**
    * Eliminar estado de localStorage
    */
   _removeFromStorage(storageKey) {
      try {
         localStorage.removeItem(storageKey);
      } catch (error) {
         // Ignorar errores al eliminar
      }
   }
}
