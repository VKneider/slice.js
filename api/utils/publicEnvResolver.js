import { readFileSync, existsSync } from 'node:fs';

const PUBLIC_PREFIX = 'SLICE_PUBLIC_';
const SUSPICIOUS_TERMS = ['SECRET', 'TOKEN', 'PASSWORD', 'PRIVATE', 'API_KEY', 'ACCESS_KEY', 'CREDENTIAL'];

function parseEnvFile(envFilePath) {
   if (!envFilePath || !existsSync(envFilePath)) {
      return {};
   }

   const fileContent = readFileSync(envFilePath, 'utf8').replace(/^\uFEFF/, '');
   const parsed = {};
   const lines = fileContent.split(/\r?\n/);

   for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
         continue;
      }

      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) {
         continue;
      }

      let key = line.slice(0, equalsIndex).trim();
      if (!key) {
         continue;
      }

      if (key.startsWith('export ')) {
         key = key.slice('export '.length).trim();
      }

      let value = line.slice(equalsIndex + 1).trim();

      const quotedWithOptionalCommentMatch = value.match(/^(["'])(.*?)\1(?:\s+#.*)?$/);

      if (quotedWithOptionalCommentMatch) {
         value = quotedWithOptionalCommentMatch[2];
      } else {
         value = value.replace(/\s+#.*$/, '').trimEnd();
      }

      parsed[key] = value;
   }

   return parsed;
}

function warnSuspiciousKey(key, logger, warnedKeys) {
   const upperKey = key.toUpperCase();
   const isSuspicious = SUSPICIOUS_TERMS.some((term) => upperKey.includes(term));

   if (isSuspicious && !warnedKeys.has(key) && logger && typeof logger.warn === 'function') {
      logger.warn(`[slice-env] Suspicious public environment key detected: ${key}`);
      warnedKeys.add(key);
   }
}

function buildPublicPayload({ envFromFile, processEnv, logger }) {
   const env = {};
   const warnedKeys = new Set();

   for (const [key, value] of Object.entries(envFromFile)) {
      if (key.startsWith(PUBLIC_PREFIX)) {
         env[key] = String(value ?? '');
         warnSuspiciousKey(key, logger, warnedKeys);
      }
   }

   for (const [key, value] of Object.entries(processEnv || {})) {
      if (key.startsWith(PUBLIC_PREFIX)) {
         env[key] = String(value ?? '');
         warnSuspiciousKey(key, logger, warnedKeys);
      }
   }

   return env;
}

export function resolvePublicEnv({ mode, envFilePath, processEnv = process.env, logger = console }) {
   const envFromFile = parseEnvFile(envFilePath);
   const env = buildPublicPayload({
      envFromFile,
      processEnv,
      logger,
   });

   return {
      mode,
      env,
   };
}

export function createPublicEnvProvider({ mode, envFilePath, processEnv = process.env, logger = console }) {
   if (mode === 'production') {
      let cachedPayload;

      return {
         getPayload() {
            if (!cachedPayload) {
               cachedPayload = resolvePublicEnv({ mode, envFilePath, processEnv, logger });
            }

            return cachedPayload;
         },
      };
   }

   return {
      getPayload() {
         return resolvePublicEnv({ mode, envFilePath, processEnv, logger });
      },
   };
}
