import Log from './Log.js';

export default class Logger {
   constructor() {
      this.logs = [];
      this.logEnabled = slice.loggerConfig.enabled;
      this.showLogsConfig = slice.loggerConfig.showLogs;
      console.log(slice.loggerConfig)

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
                              `\x1b[31mERROR\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message} - ${log.error}`
                           );
                           break;
                        case logTypes.WARNING:
                           console.warn(
                              `\x1b[33m⚠ WARNING\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`
                           );
                           break;
                        case logTypes.INFO:
                           console.log(
                              `\x1b[32m✔ INFO\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message}`
                           );
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
      } catch (error) {
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
   logError(componentSliceId, message, error) {
      this.createLog(logTypes.ERROR, componentSliceId, message, error);
   }

   /**
    * Log a warning message.
    * @param {string} componentSliceId
    * @param {string} message
    * @returns {void}
    */
   logWarning(componentSliceId, message) {
      this.createLog(logTypes.WARNING, componentSliceId, message);
   }

   /**
    * Log an info message.
    * @param {string} componentSliceId
    * @param {string} message
    * @returns {void}
    */
   logInfo(componentSliceId, message) {
      this.createLog(logTypes.INFO, componentSliceId, message);
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

// En esta misma idea, se tiene que tomar en cuenta que el componente de ToastAlert será un toastProvider y que solo debe
// haber un toastProvider en la página, por lo que se debe implementar un Singleton para el ToastProvider

const logTypes = {
   ERROR: 'error',
   WARNING: 'warning',
   INFO: 'info',
};
