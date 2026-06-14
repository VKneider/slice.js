# Error Surfacing Audit — slice.js Runtime

> Documentación de todos los puntos donde errores, stack traces y excepciones
> no se proyectan al usuario, imposibilitando atacar bugs específicamente.
>
> Cada issue incluye el bloque exacto, por qué es problemático, y la
> corrección sugerida usando `slice.logger`.
>
> **Resolved in v3.3.8** — todos los issues 1-27 han sido corregidos.
> Auditoría final adicional encontró 2 issues menores en Debugger.js
> (errores en editor modal no logueados), también corregidos.

---

## 🔴 Issue 1 — Logger.js: Error shadowing (pierde el error original)

**Archivo:** `Slice/Components/Structural/Logger/Logger.js:46-61`
**Severidad:** CRÍTICA

```js
createLog(logType, componentSliceId, message, error = null) {
    if (!this.logEnabled) return;
    let componentName;

    try {
        componentName = slice.controller.activeComponents.get(componentSliceId).constructor.name;
    } catch (error) {                         // <--- REASIGNA el parámetro `error`
        componentName = componentSliceId;
    }

    let componentCategory = slice.controller.getComponentCategory(componentName);
    if (componentSliceId === 'Slice' || componentSliceId === 'ThemeManager') componentCategory = 'Structural';
    const log = new Log(logType, componentCategory, componentSliceId, message, error);  // ← `error` es el TypeError, no el original
    this.logs.push(log);
    this.showLog(log);
}
```

**Problema:** El `catch (error)` en línea 52 hace shadowing del parámetro `error` (línea 46). Cuando `activeComponents.get(componentSliceId)` falla, `error` se reasigna a un TypeError, y el error original que el caller quería loguear se pierde permanentemente. **Cada llamada a `logError()` en todo el framework está potencialmente corrupta.**

**Solución:** Renombrar la variable del catch:

```js
} catch (_err) {
    componentName = componentSliceId;
}
```

---

## 🔴 Issue 2 — ContextManager._removeFromStorage: catch block VACÍO

**Archivo:** `Slice/Components/Structural/ContextManager/ContextManager.js:362-368`
**Severidad:** CRÍTICA

```js
_removeFromStorage(storageKey) {
    try {
        localStorage.removeItem(storageKey);
    } catch (error) {
        // Ignorar errores al eliminar
    }
}
```

**Problema:** El bloque catch está **completamente vacío** — ni siquiera un log. Si `localStorage.removeItem()` falla (sandbox, iframe, cuota excedida, modo privado), el error se traga sin dejar rastro. El desarrollador nunca sabe si la limpieza ocurrió.

**Solución:**

```js
_removeFromStorage(storageKey) {
    try {
        localStorage.removeItem(storageKey);
    } catch (error) {
        slice.logger.logWarning('ContextManager', `Error removing "${storageKey}" from localStorage`, error);
    }
}
```

---

## 🔴 Issue 3 — Router.onRouteChange: async setTimeout sin manejo de errores

**Archivo:** `Slice/Components/Structural/Router/Router.js:399-419`
**Severidad:** CRÍTICA

```js
async onRouteChange() {
    if (this.routeChangeTimeout) {
        clearTimeout(this.routeChangeTimeout);
    }

    this.routeChangeTimeout = setTimeout(async () => {   // <--- async callback sin catch
        const path = window.location.pathname;
        const routeContainersFlag = await this.renderRoutesComponentsInPage();

        if (routeContainersFlag) {
            return;
        }

        const { route, params } = this.matchRoute(path);
        if (route) {
            await this.handleRoute(route, params);
        }
    }, 10);
}
```

**Problema:** El callback de `setTimeout` es async sin `.catch()`. Cualquier `await` que falle dentro se convierte en una **unhandled promise rejection** invisible. Además, `onRouteChange()` se usa como handler de `popstate` (línea 72) donde el sistema de eventos DOM traga errores. La navegación puede fallar silenciosamente.

**Solución:**

```js
this.routeChangeTimeout = setTimeout(async () => {
    try {
        const path = window.location.pathname;
        const routeContainersFlag = await this.renderRoutesComponentsInPage();
        if (routeContainersFlag) return;
        const { route, params } = this.matchRoute(path);
        if (route) {
            await this.handleRoute(route, params);
        }
    } catch (error) {
        slice.logger.logError('Router', `Route change failed for ${window.location.pathname}`, error);
    }
}, 10);
```

---

## 🔴 Issue 4 — ContextManager.setState + EventManager.emit: `prevState` se pierde

**Archivo:** `Slice/Components/Structural/ContextManager/ContextManager.js:152`
**Archivo:** `Slice/Components/Structural/EventManager/EventManager.js:165-190`
**Severidad:** CRÍTICA

ContextManager.js:152
```js
slice.events.emit(`context:${name}`, newState, prevState);
//                                        ^^^^^^^^^^  ← se pasa como 3er argumento
```

EventManager.js:165
```js
emit(eventName, data = null) {  // <--- SOLO acepta 2 parámetros
    // ...
    subscription.callback(data);  // ← solo pasa 1 argumento al callback
}
```

ContextManager.js:214-217 (watch wrapper)
```js
const wrappedCallback = (newState, prevState) => {
    if (selector) {
        const newSelectedValue = this._applySelector(newState, selector);
        const prevSelectedValue = this._applySelector(prevState, selector);
        // prevSelectedValue recibe undefined porque prevState nunca llega
```

**Problema:** `EventManager.emit()` solo acepta `(eventName, data)`. El tercer argumento `prevState` que pasa `ContextManager.setState()` se **pierde silenciosamente**. Los watchers que usan selector reciben `undefined` como `prevState`, y `_applySelector(undefined, selector)` llama `selector(undefined)` que probablemente lanza, activando el Issue 11 (catch silencioso en _applySelector). Es un bug compuesto que hace que los selectores con `prevState` **nunca funcionen** sin ningún error visible.

**Solución:** Extender `EventManager.emit()` para pasar todos los argumentos:

```js
emit(eventName, ...args) {
    // ...
    subscription.callback(...args);
}
```

---

## 🟡 Issue 5 — Router._executeBeforeEachGuard: error en guard CONTINÚA navegación

**Archivo:** `Slice/Components/Structural/Router/Router.js:257-270`
**Severidad:** GRAVE

```js
try {
    await this._beforeEachGuard(to, from, next);

    if (!nextCalled) {
        slice.logger.logWarning('Router', 'beforeEach guard did not call next(). Navigation will continue.');
    }

    return redirectPath ? { path: redirectPath, options: redirectOptions } : null;
} catch (error) {
    slice.logger.logError('Router', 'Error in beforeEach guard', error);
    return null; // <--- "En caso de error, continuar con la navegación"
}
```

**Problema:** Si el `beforeEach` guard del usuario lanza una excepción, el framework la loguea pero **continúa la navegación** como si el guard hubiera aprobado. Un bug en un permiso de ruta deja pasar al usuario a donde no debería.

**Solución:**

```js
} catch (error) {
    slice.logger.logError('Router', `Error in beforeEach guard from "${from?.path}" to "${to?.path}"`, error);
    return false; // false = bloquea navegación
}
```

---

## 🟡 Issue 6 — Slice.getClass: retorna undefined silenciosamente

**Archivo:** `Slice/Slice.js:37-44`
**Severidad:** GRAVE

```js
async getClass(module) {
    try {
        const { default: myClass } = await import(module);
        return await myClass;
    } catch (error) {
        this.logger.logError('Slice', `Error loading class ${module}`, error);
    }
    // returns undefined implicitamente
}
```

**Problema:** Cuando falla `import(module)`, retorna `undefined`. Los callers (init líneas 450, 462, 470, 478, 486, 512, 572) hacen `new moduleClass()` y obtienen "X is not a constructor" — error engañoso que no revela la causa raíz.

**Solución:**

```js
async getClass(module) {
    try {
        const { default: myClass } = await import(module);
        return await myClass;
    } catch (error) {
        this.logger.logError('Slice', `Error loading class ${module}`, error);
        throw error; // Relanzar para que el caller sepa que falló
    }
}
```

---

## 🟡 Issue 7 — Controller.registerBundle: Promise que nunca resuelve

**Archivo:** `Slice/Components/Structural/Controller/Controller.js:488-545`
**Severidad:** GRAVE

```js
return new Promise((resolve) => {
    const processChunk = () => {
        const sliceEntries = entries.slice(index, index + chunkSize);

        for (const [componentName, componentData] of sliceEntries) {
            try {
                // ... registro de template, css, class ...
            } catch (error) {
                slice.logger.logError('Controller', `❌ Failed to register component ${componentName}`, error);
            }
        }

        index += chunkSize;
        if (index < entries.length) {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(processChunk);
            } else {
                setTimeout(processChunk, 0);
            }
            return;
        }

        resolve(true);
    };

    processChunk();
});
```

**Problema:** Si `processChunk()` lanza un error **fuera** del try/catch interno (ej. `entries` es undefined), nunca se llama `resolve()`. Cualquier `await registerBundle()` queda colgado para siempre, sin timeout ni feedback.

**Solución:**

```js
return new Promise((resolve) => {
    const processChunk = () => {
        try {
            const sliceEntries = entries.slice(index, index + chunkSize);
            for (const [componentName, componentData] of sliceEntries) {
                try {
                    // ... registro ...
                } catch (error) {
                    slice.logger.logError('Controller', `Failed to register component ${componentName}`, error);
                }
            }

            index += chunkSize;
            if (index < entries.length) {
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(processChunk);
                } else {
                    setTimeout(processChunk, 0);
                }
                return;
            }

            resolve(true);
        } catch (error) {
            slice.logger.logError('Controller', 'Fatal error in registerBundle processChunk', error);
            resolve(false);
        }
    };

    processChunk();
});
```

---

## 🟡 Issue 8 — Router.setupMutationObserver: callback sin try/catch

**Archivo:** `Slice/Components/Structural/Router/Router.js:530-563`
**Severidad:** GRAVE

```js
setupMutationObserver() {
    if (typeof MutationObserver !== 'undefined') {
        this.observer = new MutationObserver((mutations) => {
            let shouldInvalidateCache = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
                    // ...
                }
            });
            if (shouldInvalidateCache) this.invalidateCache();
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
    }
}
```

**Problema:** Si el callback del `MutationObserver` lanza, el navegador **detiene permanentemente** el observer. El ruteo basado en detección de DOM deja de funcionar sin que nadie lo sepa.

**Solución:**

```js
this.observer = new MutationObserver((mutations) => {
    try {
        let shouldInvalidateCache = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes || []);
                const removedNodes = Array.from(mutation.removedNodes || []);
                // ...
            }
        });
        if (shouldInvalidateCache) this.invalidateCache();
    } catch (error) {
        slice.logger.logError('Router', 'Error in MutationObserver callback', error);
    }
});
```

---

## 🟡 Issue 9 — ContextManager._saveToStorage: error no propagado al caller

**Archivo:** `Slice/Components/Structural/ContextManager/ContextManager.js:351-356`
**Severidad:** GRAVE

```js
_saveToStorage(name, state, storageKey) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
        slice.logger.logWarning('ContextManager', `Error guardando "${name}" en localStorage`, error);
    }
}
```

**Problema:** El error se loguea como warning, pero el caller (`setState`) **no sabe que falló**. Si el usuario configuró `{ persist: true }`, espera que los datos sobrevivan un reload, pero la falla es invisible.

**Solución:**

```js
_saveToStorage(name, state, storageKey) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
        slice.logger.logError('ContextManager', `Error saving "${name}" to localStorage`, error);
        throw error; // O: retornar false y que el caller decida
    }
}
```

---

## 🟡 Issue 10 — ContextManager._applySelector: error en selector retorna undefined silenciosamente

**Archivo:** `Slice/Components/Structural/ContextManager/ContextManager.js:290-297`
**Severidad:** GRAVE

```js
_applySelector(state, selector) {
    try {
        return selector(state);
    } catch (error) {
        slice.logger.logWarning('ContextManager', 'Error al aplicar selector', error);
        return undefined;
    }
}
```

**Problema:** Si un selector del usuario lanza (ej. acceder a propiedad en `undefined`), se loguea como **warning** y retorna `undefined`. El `wrappedCallback` recibe `undefined` sin saber que el selector falló. Como `prevState` nunca llega (Issue 4), esto se dispara en cada `setState()` con selector.

**Solución:**

```js
_applySelector(state, selector) {
    try {
        return selector(state);
    } catch (error) {
        slice.logger.logError('ContextManager', 'Error applying selector', error);
        throw error; // Relanzar para que el wrappedCallback sepa que falló
    }
}
```

---

## 🟡 Issue 11 — Controller.registerBundleLegacy: dependencias usan `${error}` (pierden stack)

**Archivo:** `Slice/Components/Structural/Controller/Controller.js:347-397`
**Severidad:** GRAVE

```js
} catch (evalError) {
    slice.logger.logWarning('Controller',
        `❌ Failed to evaluate processed dependency ${depName}: ${evalError}`);
    //                                                            ^^^^^^^^^  ← toString(), pierde stack
    try {
        new Function(/* depContent */)(/* ... */);
    } catch (fallbackError) {
        slice.logger.logWarning('Controller',
            `❌ Fallback evaluation also failed for ${depName}: ${fallbackError}`);
    }
}
// outer catch:
} catch (depError) {
    slice.logger.logWarning('Controller',
        `⚠️ Failed to load dependency ${depName} for ${componentName}: ${depError}`);
}
```

**Problema:** `${evalError}` llama a `toString()` que solo da `Error: message`. El stack trace se pierde. Para errores de `new Function()` el stack es crítico (posición exacta del error de sintaxis). Adicionalmente, todo se loguea como **warning**, no como error.

**Solución:**

```js
} catch (evalError) {
    slice.logger.logError('Controller',
        `Failed to evaluate processed dependency ${depName} for ${componentName}`, evalError);
}
```

---

## 🟡 Issue 12 — Controller.registerBundleLegacy: clase usa `${error}` (pierde stack)

**Archivo:** `Slice/Components/Structural/Controller/Controller.js:453-456`
**Severidad:** GRAVE

```js
} catch (error) {
    slice.logger.logWarning('Controller',
        `❌ Failed to evaluate class for ${componentName}: ${error}`);
    //                                                         ^^^^^^^^^  ← toString(), pierde stack
}
```

**Problema:** Mismo patrón — `${error}` pierde el stack trace, y se loguea como warning en vez de error.

**Solución:**

```js
} catch (error) {
    slice.logger.logError('Controller', `Failed to evaluate class for ${componentName}`, error);
}
```

---

## 🟡 Issue 13 — Controller.loadTemplateToComponent: logError con firma incorrecta

**Archivo:** `Slice/Components/Structural/Controller/Controller.js:807-809`
**Severidad:** GRAVE

```js
loadTemplateToComponent(component) {
    const className = component.constructor.name;
    const template = this.templates.get(className);

    if (!template) {
        slice.logger.logError(`Template not found for component: ${className}`);
        //                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //                Solo 1 argumento — se interpreta como source, no como message
        return;
    }
```

**Problema:** En todo el código la firma de `logError` es `(source, message, error?)`. Aquí se pasa un solo string. El logger interpreta `"Template not found..."` como el **source** (categoría), y `message` queda como `undefined`. El error se registra mal y es invisible en filtros por categoría.

**Solución:**

```js
slice.logger.logError('Controller', `Template not found for component: ${className}`);
```

---

## 🟡 Issue 14 — Slice.js init: fetch silencia errores con `.catch(() => null)`

**Archivo:** `Slice/Slice.js:330-337`
**Severidad:** GRAVE

```js
const [envResult, configResult] = await Promise.all([
    fetch('/slice-env.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),   // <--- TRAGA TODO: network error, JSON inválido, CORS, etc
    fetch('/bundles/bundle.config.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)    // <--- idem
]);
```

**Problema:** El `.catch(() => null)` convierte **cualquier error** (network, CORS, JSON malformado, DNS failure) en `null`. Aunque 404 es esperado para `/slice-env.json`, si `bundle.config.json` tiene JSON corrupto, el error se traga y el app cae a modo development sin que nadie sepa por qué. El error original se pierde completamente.

**Solución:**

```js
fetch('/slice-env.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .catch(error => {
        slice.logger.logWarning('Slice', 'Error fetching /slice-env.json', error);
        return null;
    })
```

---

## 🟡 Issue 15 — Slice.js init: early return con undefined en init failure

**Archivo:** `Slice/Slice.js:317-324`
**Severidad:** GRAVE

```js
const sliceConfig = await loadConfig();
if (!sliceConfig) {
    console.error('%c⛔️ Error loading Slice configuration ⛔️', 'color: red; font-size: 20px;');
    alert('Error loading Slice configuration');
    return;  // <--- init() resuelve con undefined, no rejected
}
```

**Problema:** `init()` retorna temprano sin lanzar error. Quien hace `await init()` recibe `undefined` como si todo estuviera bien. No hay forma de detectar programáticamente que el framework no se inicializó.

**Solución:**

```js
const sliceConfig = await loadConfig();
if (!sliceConfig) {
    const err = new Error('Failed to load Slice configuration');
    slice.logger.logError('Slice', err.message, err);
    throw err;
}
```

---

## 🟡 Issue 16 — Slice.js init: framework bundle import usa `e?.message || e` (pierde stack)

**Archivo:** `Slice/Slice.js:355-364`
**Severidad:** GRAVE

```js
try {
    await import(`/bundles/${bundleConfigJson.bundles.framework.file}`);
    if (window.SLICE_FRAMEWORK_CLASSES) {
        frameworkClasses = window.SLICE_FRAMEWORK_CLASSES;
    }
} catch (e) {
    // framework bundle failed — fall through to individual imports
    console.error('[Slice.js] framework bundle import failed:', e?.message || e);
    //                                                          ^^^^^^^^^^^^^^^^  ← pierde stack
}
```

**Problema:** `e?.message` extrae solo el mensaje, el stack trace se pierde del log. Si el bundle falla por un error de sintaxis en una dependencia, el mensaje solo no da suficiente información.

**Solución:**

```js
} catch (e) {
    console.error('[Slice.js] framework bundle import failed:', e);
    slice.logger.logError('Slice', `Framework bundle import failed`, e);
}
```

---

## 🟡 Issue 17 — Slice.js init: route preload lanza error como unhandled rejection

**Archivo:** `Slice/Slice.js:427-437`
**Severidad:** GRAVE

```js
const preloadRouteBundles = () => {
    loadRouteBundles().catch((error) => {
        const bundlingError = createBundlingInitError(
            `idle route preload "${initialPath}"`,
            error
        );
        queueMicrotask(() => {
            throw bundlingError;    // <--- se convierte en unhandled rejection
        });
    });
};
```

**Problema:** El error se relanza dentro de `queueMicrotask`, convirtiéndose en un evento `unhandledrejection` a nivel window. Ningún caller puede capturarlo. Es un error que aparece como "crash" sin contexto.

**Solución:**

```js
loadRouteBundles().catch((error) => {
    const bundlingError = createBundlingInitError(
        `idle route preload "${initialPath}"`,
        error
    );
    slice.logger.logError('Slice', bundlingError.message, bundlingError);
});
```

---

## 🟡 Issue 18 — EventManager.emit: error en callback no se propaga

**Archivo:** `Slice/Components/Structural/EventManager/EventManager.js:186-190`
**Severidad:** GRAVE

```js
try {
    subscription.callback(data);
} catch (error) {
    slice.logger.logError('EventManager', `Error en callback de "${eventName}" [${subscriptionId}]`, error);
}
```

**Problema:** Aunque es correcto no dejar que un callback rompa la cadena de notificación, el error solo queda en el logger interno. `emit()` retorna `void`. El caller de `emit()` (como `ContextManager.setState()`) no tiene idea de que algún callback falló. Los errores en watchers de contexto son invisibles.

**Solución:** Adicional al log, emitir un evento de error para que el sistema pueda reaccionar:

```js
} catch (error) {
    slice.logger.logError('EventManager', `Error en callback de "${eventName}" [${subscriptionId}]`, error);
}
```

(Mantener el catch, pero considerar añadir un hook global de errores.)

---

## 🟡 Issue 19 — api/index.js: sendFile SPA fallback NO loguea error

**Archivo:** `api/index.js:244-259`
**Severidad:** GRAVE

```js
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, `../${folderDeployed}`, "App", 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).send(`<h1>404 - Page Not Found</h1>...`);
            // err NO se loguea en ningún lado
        }
    });
});
```

**Problema:** Si `sendFile` falla (permisos, disco, path incorrecto), el error se **descarta completamente**. Se envía un 404 genérico incluso si el error real es un 500. No hay log en el servidor.

**Solución:**

```js
if (err) {
    console.error(`[SPA Fallback] Error sending ${indexPath}:`, err);
    res.status(500).send(`<h1>500 - Internal Server Error</h1>`);
}
```

---

## 🟡 Issue 20 — api/index.js: readFileSync sin try/catch en ruta /Slice/Slice.js

**Archivo:** `api/index.js:111-118`
**Severidad:** GRAVE

```js
app.get('/Slice/Slice.js', (req, res) => {
    const slicePath = path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice', 'Slice.js');
    if (fs.existsSync(slicePath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        return res.send(fs.readFileSync(slicePath, 'utf8'));  // <--- sin try/catch
    }
    return res.status(404).send('Slice.js not found');
});
```

**Problema:** `existsSync` solo verifica existencia, no permisos de lectura. Si el archivo existe pero no es legible, `readFileSync` lanza una excepción no capturada que puede crashear el servidor Express.

**Solución:**

```js
app.get('/Slice/Slice.js', (req, res) => {
    const slicePath = path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice', 'Slice.js');
    try {
        if (fs.existsSync(slicePath)) {
            const content = fs.readFileSync(slicePath, 'utf8');
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            return res.send(content);
        }
    } catch (error) {
        console.error(`Error reading Slice.js:`, error);
        return res.status(500).send('Error loading framework');
    }
    return res.status(404).send('Slice.js not found');
});
```

---

## 🟡 Issue 21 — api/utils/publicEnvResolver.js: readFileSync sin try/catch

**Archivo:** `api/utils/publicEnvResolver.js:6-11`
**Severidad:** GRAVE

```js
function parseEnvFile(envFilePath) {
    if (!envFilePath || !existsSync(envFilePath)) {
        return {};
    }
    const fileContent = readFileSync(envFilePath, 'utf8').replace(/^\uFEFF/, '');
    // No try/catch — si existe pero no se puede leer, explota
```

**Problema:** `existsSync` no garantiza legibilidad. Si el `.env` file existe pero tiene permisos restrictivos, `readFileSync` lanza una excepción no capturada que se propaga hasta el route handler de `/slice-env.json`, potencialmente crasheando la respuesta.

**Solución:**

```js
function parseEnvFile(envFilePath) {
    if (!envFilePath || !existsSync(envFilePath)) {
        return {};
    }
    try {
        const fileContent = readFileSync(envFilePath, 'utf8').replace(/^\uFEFF/, '');
        // ... resto del parsing
    } catch (error) {
        console.error(`Error reading env file ${envFilePath}:`, error);
        return {};
    }
}
```

---

## 🟡 Issue 22 — api/index.js: bundle file error usa `${error.message}` (pierde stack)

**Archivo:** `api/index.js:143-145`
**Severidad:** GRAVE

```js
} catch (error) {
    console.log(`❌ Error reading bundle file: ${error.message}`);
    //                                              ^^^^^^^^^^^^  ← solo message, pierde stack
    return res.status(500).send('Error reading bundle file');
}
```

**Problema:** `${error.message}` descarta el stack trace. Errores de filesystem en producción son mucho más difíciles de debuggear sin stack.

**Solución:**

```js
} catch (error) {
    console.error(`Error reading bundle file:`, error);
    return res.status(500).send('Error reading bundle file');
}
```

---

## 🔵 Issue 23 — Router._emitRouteChange: mensaje genérico sin identificadores

**Archivo:** `Slice/Components/Structural/Router/Router.js~619-621`
**Severidad:** MODERADA

```js
} catch (error) {
    slice.logger.logError('Router', `Error rendering route container`, error);
}
```

**Problema:** No dice **qué container** ni **qué ruta** falló.

**Solución:**

```js
slice.logger.logError('Router', `Error rendering route container for path ${window.location.pathname}`, error);
```

---

## 🔵 Issue 24 — ContextManager._loadFromStorage: null ambiguo

**Archivo:** `Slice/Components/Structural/ContextManager/ContextManager.js:336-346`
**Severidad:** MODERADA

```js
_loadFromStorage(storageKey) {
    try {
        const data = localStorage.getItem(storageKey);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        slice.logger.logWarning('ContextManager', `Error cargando "${storageKey}" de localStorage`, error);
    }
    return null;  // <--- mismo null para "no hay data" y "JSON corrupto"
}
```

**Problema:** `null` significa dos cosas distintas: "no había datos guardados" o "los datos estaban corruptos". Indistinguible para el caller.

**Solución:**

```js
_loadFromStorage(storageKey) {
    try {
        const data = localStorage.getItem(storageKey);
        if (data === null) return null; // No hay datos
        return JSON.parse(data);
    } catch (error) {
        slice.logger.logError('ContextManager', `Error loading corrupted data for "${storageKey}"`, error);
        return undefined; // Datos corruptos — distinguible de "no data"
    }
}
```

---

## 🔵 Issue 25 — Debugger.openAdvancedEditor: JSON.stringify falla, muestra 'null' sin log

**Archivo:** `Slice/Components/Structural/Debugger/Debugger.js:557-561`
**Severidad:** MODERADA

```js
try {
    this.propertyEditor.value = JSON.stringify(value, null, 2);
} catch (error) {
    this.propertyEditor.value = 'null';  // <--- error COMPLETAMENTE ignorado
    // error no se usa, no se loguea
}
```

**Problema:** Si el valor es circular o contiene BigInt, el editor muestra `"null"`. El usuario del debugger no tiene idea que la serialización falló — asume que el valor es literalmente `null`.

**Solución:**

```js
} catch (error) {
    slice.logger.logError('Debugger', 'Error serializing property value for editor', error);
    this.propertyEditor.value = `/* Error: ${error.message} */`;
}
```

---

## 🔵 Issue 26 — Slice.js init: individual imports fallback usa `e?.message || e`

**Archivo:** `Slice/Slice.js:377-378`
**Severidad:** MODERADA

```js
} catch (e) {
    console.error('[Slice.js] individual imports fallback failed:', e?.message || e);
    throw e;
}
```

**Problema:** Aunque relanza, el log descarta el stack. Si el error se captura más arriba (en `init`), el stack original se pierde.

**Solución:**

```js
} catch (e) {
    console.error('[Slice.js] individual imports fallback failed:', e);
    throw e;
}
```

---

## 🔵 Issue 27 — Pervasivo: errores solo en console, sin UI para el usuario

**Archivo:** Todo el runtime — Logger.js:19-22, y cada `slice.logger.logError()`
**Severidad:** SISTÉMICA

```js
// Logger.js:19-22
case logTypes.ERROR:
    console.error(`\x1b[31mERROR\x1b[0m - ${log.componentCategory} - ${log.componentSliceId} - ${log.message} - ${log.error}`);
    break;
```

```js
// Logger.js:138-139 — TODO comentado
// En esta misma idea, se tiene que tomar en cuenta que el componente de ToastAlert
// será un toastProvider y que solo debe haber un toastProvider en la página, por lo
// que se debe implementar un Singleton para el ToastProvider
```

**Problema:** No existe un mecanismo centralizado que muestre errores al **usuario final** en la UI del navegador. El Logger tiene la intención de un `ToastProvider` (comentario en líneas 138-139) pero nunca se implementó.

**Solución:** Implementar el `ToastProvider` como medio de proyección de errores al usuario.

---

## Estado de Corrección

Todos los issues han sido corregidos en **v3.3.8**.

Los issues 28-29 fueron identificados durante la auditoría final y corregidos inmediatamente.

---

## 📋 Tabla Resumen Completa

| # | Severidad | Archivo | Issue | Estado |
|---|-----------|---------|-------|--------|
| 1 | 🔴 CRÍTICA | `Logger/Logger.js` | Shadowing de `error` → pierde error original | ✅ Corregido |
| 2 | 🔴 CRÍTICA | `ContextManager/ContextManager.js` | Catch block VACÍO `_removeFromStorage` | ✅ Corregido |
| 3 | 🔴 CRÍTICA | `Router/Router.js` | Async setTimeout sin catch en `onRouteChange` | ✅ Corregido |
| 4 | 🔴 CRÍTICA | `ContextManager.js` + `EventManager.js` | `prevState` se pierde → selectores rotos | ✅ Corregido |
| 5 | 🟡 GRAVE | `Router/Router.js` | Error en guard CONTINÚA navegación | ✅ Corregido |
| 6 | 🟡 GRAVE | `Slice.js` | `getClass()` retorna `undefined` | ✅ Corregido |
| 7 | 🟡 GRAVE | `Controller/Controller.js` | Promise nunca resuelve en `registerBundle` | ✅ Corregido |
| 8 | 🟡 GRAVE | `Router/Router.js` | MutationObserver sin try/catch | ✅ Corregido |
| 9 | 🟡 GRAVE | `ContextManager/ContextManager.js` | Persistencia falla, caller no sabe | ✅ Corregido |
| 10 | 🟡 GRAVE | `ContextManager/ContextManager.js` | Selector retorna undefined silenciosamente | ✅ Corregido |
| 11 | 🟡 GRAVE | `Controller/Controller.js` | Dependencias: `${error}` pierde stack + warning | ✅ Corregido |
| 12 | 🟡 GRAVE | `Controller/Controller.js` | Clases: `${error}` pierde stack + warning | ✅ Corregido |
| 13 | 🟡 GRAVE | `Controller/Controller.js` | `logError` con argumentos incorrectos | ✅ Corregido |
| 14 | 🟡 GRAVE | `Slice.js` | `.catch(() => null)` traga errores de fetch | ✅ Corregido |
| 15 | 🟡 GRAVE | `Slice.js` | `init()` retorna undefined en fallo de config | ✅ Corregido |
| 16 | 🟡 GRAVE | `Slice.js` | `e?.message || e` pierde stack en bundle import | ✅ Corregido |
| 17 | 🟡 GRAVE | `Slice.js` | Error en preloadRouteBundles → unhandled rejection | ✅ Corregido |
| 18 | 🟡 GRAVE | `EventManager/EventManager.js` | Error en callback no se propaga | ✅ Corregido |
| 19 | 🟡 GRAVE | `api/index.js` | sendFile error NO logueado | ✅ Corregido |
| 20 | 🟡 GRAVE | `api/index.js` | readFileSync sin try/catch en ruta Slice.js | ✅ Corregido |
| 21 | 🟡 GRAVE | `api/utils/publicEnvResolver.js` | readFileSync sin try/catch en env file | ✅ Corregido |
| 22 | 🟡 GRAVE | `api/index.js` | `${error.message}` pierde stack en bundle error | ✅ Corregido |
| 23 | 🔵 MODERADA | `Router/Router.js` | Mensaje genérico sin ID de container | ✅ Corregido |
| 24 | 🔵 MODERADA | `ContextManager/ContextManager.js` | null ambiguo: "no data" vs "corrupto" | ✅ Corregido |
| 25 | 🔵 MODERADA | `Debugger/Debugger.js` | JSON.stringify falla, muestra 'null' sin log | ✅ Corregido |
| 26 | 🔵 MODERADA | `Slice.js` | `e?.message || e` pierde stack (individual imports) | ✅ Corregido |
| 27 | 🔵 SISTÉMICA | (todo el runtime) | Solo console, sin UI de errores — ToastProvider ya existe en visual_library como Service, integración es responsabilidad de cada app | ❌ No aplica |
| 28 | 🔵 MODERADA | `Debugger/Debugger.js` | `validateEditor()` catch no loguea error | ✅ Corregido |
| 29 | 🔵 MODERADA | `Debugger/Debugger.js` | `savePropertyValue()` catch no loguea error | ✅ Corregido |
