const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const formatValueForLog = (value) => {
   if (typeof value === 'string') {
      return `'${value}'`;
   }

   if (value === undefined) return 'undefined';

   try {
      return JSON.stringify(value);
   } catch (_) {
      return String(value);
   }
};

const collectInvalidAllowedValueProps = (staticProps, providedProps) => {
   const invalid = [];
   const safeProvidedProps = providedProps || {};

   Object.entries(staticProps || {}).forEach(([propName, config]) => {
      const allowedValues = config?.allowedValues;
      if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
         return;
      }

      if (!hasOwn(safeProvidedProps, propName)) {
         return;
      }

      const value = safeProvidedProps[propName];
      const isAllowed = allowedValues.some((allowedValue) => allowedValue === value);
      if (!isAllowed) {
         invalid.push({
            propName,
            value,
            allowedValues
         });
      }
   });

   return invalid;
};

const formatAllowedValuesForLog = (allowedValues) => {
   if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
      return '[]';
   }
   return `[${allowedValues.map((value) => formatValueForLog(value)).join(', ')}]`;
};

export { collectInvalidAllowedValueProps, formatAllowedValuesForLog };
