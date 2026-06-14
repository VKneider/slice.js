   import Log from './Log.js';

const logTypes = {
   ERROR: 'error',
   WARN: 'warn',
   INFO: 'info',
   DEBUG: 'debug',
};

export default class Logger {
   constructor() {
      this.logs = [];
      this.logEnabled = slice.loggerConfig.enabled;
      this.showLogsConfig = slice.loggerConfig.showLogs;

      this.showLog = function showLog(log) {
         if (!this.showLogsConfig) return;

         const logType = log.logType;

         Object.keys(this.showLogsConfig).forEach((logConfig) => {
            if (this.showLogsConfig[logConfig][logType] === true) {
               switch (logConfig) {
                  case 'console':
                     switch (logType) {
                        case logTypes.ERROR:
                           console.error(
                              `\x1b[31mERROR\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`,
                              log.error
                           );
                           break;
                        case logTypes.WARN:
                           if (log.error) {
                              console.warn(
                                 `\x1b[33m⚠ WARN\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`,
                                 log.error
                              );
                           } else {
                              console.warn(
                                 `\x1b[33m⚠ WARN\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`
                              );
                           }
                           break;
                        case logTypes.INFO:
                           if (log.error) {
                              console.log(
                                 `\x1b[32m✔ INFO\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`,
                                 log.error
                              );
                           } else {
                              console.log(
                                 `\x1b[32m✔ INFO\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`
                              );
                           }
                           break;
                        case logTypes.DEBUG:
                           if (log.error) {
                              console.debug(
                                 `\x1b[36m🔍 DEBUG\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`,
                                 log.error
                              );
                           } else {
                              console.debug(
                                 `\x1b[36m🔍 DEBUG\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`
                              );
                           }
                           break;
                        default:
                           console.log(
                              `\x1b[37mUNKNOWN\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`
                           );
                     }
                     break;
               }
            }
         });
      };
   }

   createLog(logType, componentSliceId, message, error = null) {
      if (!this.logEnabled) return;
      let componentName;

      try {
         componentName = slice.controller.activeComponents.get(componentSliceId).constructor.name;
      } catch (_err) {
         componentName = componentSliceId;
      }

      let componentCategory = slice.controller.getComponentCategory(componentName);
      if (componentSliceId === 'Slice' || componentSliceId === 'ThemeManager') componentCategory = 'Structural';
      const log = new Log(logType, componentCategory, componentSliceId, message, error);
      this.logs.push(log);
      this.showLog(log);
   }

   /**
    * Log an error message.
    * @param {string} componentSliceId
    * @param {string} message
    * @param {any} [error]
    * @returns {void}
    */
   error(componentSliceId, message, error) {
      this.createLog(logTypes.ERROR, componentSliceId, message, error);
   }

   /**
    * Log a warning message.
    * @param {string} componentSliceId
    * @param {string} message
    * @param {any} [error]
    * @returns {void}
    */
   warn(componentSliceId, message, error) {
      this.createLog(logTypes.WARN, componentSliceId, message, error);
   }

   /**
    * Log an info message.
    * @param {string} componentSliceId
    * @param {string} message
    * @param {any} [error]
    * @returns {void}
    */
   info(componentSliceId, message, error) {
      this.createLog(logTypes.INFO, componentSliceId, message, error);
   }

   /**
    * Log a debug message.
    * @param {string} componentSliceId
    * @param {string} message
    * @param {any} [error]
    * @returns {void}
    */
   debug(componentSliceId, message, error) {
      this.createLog(logTypes.DEBUG, componentSliceId, message, error);
   }

   // ── Retrocompatibilidad: métodos antiguos redirigen a los nuevos ──

   /** @deprecated Use .error() instead */
   logError(componentSliceId, message, error) {
      this.error(componentSliceId, message, error);
   }

   /** @deprecated Use .warn() instead */
   logWarning(componentSliceId, message, error) {
      this.warn(componentSliceId, message, error);
   }

   /** @deprecated Use .info() instead */
   logInfo(componentSliceId, message, error) {
      this.info(componentSliceId, message, error);
   }

   /**
    * Get all logs.
    * @returns {Array}
    */
   getLogs() {
      return this.logs;
   }

   /**
    * Clear all logs.
    * @returns {void}
    */
   clearLogs() {
      this.logs = [];
   }

   /**
    * Filter logs by type.
    * @param {string} type
    * @returns {Array}
    */
   getLogsByLogType(type) {
      return this.logs.filter((log) => log.logType === type);
   }

   /**
    * Filter logs by component category.
    * @param {string} componentCategory
    * @returns {Array}
    */
   getLogsByComponentCategory(componentCategory) {
      return this.logs.filter((log) => log.componentCategory === componentCategory);
   }

   /**
    * Filter logs by component sliceId.
    * @param {string} componentSliceId
    * @returns {Array}
    */
   getLogsByComponent(componentSliceId) {
      return this.logs.filter((log) => log.componentSliceId === componentSliceId);
   }
}
