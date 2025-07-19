// Slice/Components/Structural/Router/EventThrottler.js

/**
 * Sistema de throttling optimizado para eventos del router
 * Mejora significativa sobre el setTimeout básico actual
 */
export default class EventThrottler {
   constructor() {
      this.timeouts = new Map();
      this.executingCallbacks = new Set();
      this.defaultDelay = 10;
   }

   /**
    * Throttle con memoria de callbacks en ejecución
    * Evita race conditions y callbacks duplicados
    */
   throttle(key, callback, delay = this.defaultDelay) {
      // Si ya se está ejecutando este callback, ignorar
      if (this.executingCallbacks.has(key)) {
         return Promise.resolve();
      }

      // Cancelar timeout anterior si existe
      if (this.timeouts.has(key)) {
         clearTimeout(this.timeouts.get(key));
      }

      return new Promise((resolve, reject) => {
         const timeoutId = setTimeout(async () => {
            this.executingCallbacks.add(key);
            this.timeouts.delete(key);
            
            try {
               const result = await callback();
               resolve(result);
            } catch (error) {
               reject(error);
            } finally {
               this.executingCallbacks.delete(key);
            }
         }, delay);

         this.timeouts.set(key, timeoutId);
      });
   }

   /**
    * Debounce mejorado con cancelación manual
    */
   debounce(key, callback, delay = this.defaultDelay) {
      if (this.timeouts.has(key)) {
         clearTimeout(this.timeouts.get(key));
      }

      return new Promise((resolve) => {
         const timeoutId = setTimeout(async () => {
            this.timeouts.delete(key);
            const result = await callback();
            resolve(result);
         }, delay);

         this.timeouts.set(key, timeoutId);
      });
   }

   /**
    * Cancelar un throttle/debounce específico
    */
   cancel(key) {
      if (this.timeouts.has(key)) {
         clearTimeout(this.timeouts.get(key));
         this.timeouts.delete(key);
         return true;
      }
      return false;
   }

   /**
    * Cancelar todos los throttles/debounces pendientes
    */
   cancelAll() {
      for (const timeoutId of this.timeouts.values()) {
         clearTimeout(timeoutId);
      }
      this.timeouts.clear();
      this.executingCallbacks.clear();
   }

   /**
    * Verificar si hay un throttle/debounce pendiente
    */
   isPending(key) {
      return this.timeouts.has(key);
   }

   /**
    * Verificar si un callback se está ejecutando
    */
   isExecuting(key) {
      return this.executingCallbacks.has(key);
   }

   /**
    * Cleanup para evitar memory leaks
    */
   destroy() {
      this.cancelAll();
   }
}