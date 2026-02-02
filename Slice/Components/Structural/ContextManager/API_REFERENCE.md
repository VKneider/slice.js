# ContextManager API Reference

## Overview

`ContextManager` provides shared state with watchers and optional persistence. It uses `EventManager` internally to notify watchers.

## Initialization

The instance is created dynamically by Slice when `sliceConfig.context.enabled` is `true`.

```js
// sliceConfig.json
{
  "context": { "enabled": true }
}
```

If enabled, Slice loads and instantiates it, then calls `init()` when present.

## API

### `init()`

Optional initialization hook. Returns `true` by default.

### `create(name, initialState?, options?)`

Create a new context.

-  `name` (string) Unique context name.
-  `initialState` (Object, optional) Initial state.
-  `options` (Object, optional)
   -  `persist` (boolean) Store in `localStorage`.
   -  `storageKey` (string) Custom storage key.

```js
slice.context.create('auth', { isLoggedIn: false }, { persist: true });
```

### `getState(name)`

Returns the current state or `null` if missing.

```js
const auth = slice.context.getState('auth');
```

### `setState(name, updater)`

Update state. Accepts a new state object or a function `(prev) => newState`.

```js
slice.context.setState('cart', (prev) => ({
   ...prev,
   items: [...prev.items, item],
}));
```

### `watch(name, component, callback, selector?)`

Watch a context and run `callback` when it changes. Supports optional selectors to reduce updates.

-  `component` must be a Slice component (for auto-cleanup).
-  `selector` (Function, optional) Returns a portion of state to compare.

```js
slice.context.watch(
   'auth',
   this,
   (isLoggedIn) => {
      this.toggle(isLoggedIn);
   },
   (state) => state.isLoggedIn
);
```

### `has(name)`

Returns `true` if the context exists.

### `destroy(name)`

Removes the context and any persisted storage.

### `list()`

Returns an array of context names.

## Notes

-  `ContextManager` emits `context:<name>` via `EventManager` for watcher updates.
-  When `context.enabled` is `false`, Slice provides a no-op implementation to avoid runtime errors.

## Usage Patterns

### Auth session context

Create a persistent auth context and update it from a login form.

```js
slice.context.create(
   'auth',
   {
      isLoggedIn: false,
      user: null,
      token: null,
   },
   { persist: true }
);

class LoginForm extends HTMLElement {
   async init() {
      this.querySelector('form').addEventListener('submit', (e) => this.handleSubmit(e));
   }

   async handleSubmit(e) {
      e.preventDefault();
      const user = await this.login();
      slice.context.setState('auth', {
         isLoggedIn: true,
         user,
         token: user.token,
      });
   }
}
```

### UI toggles

Use a UI context to keep shared UI state consistent.

```js
slice.context.create('ui', { sidebarOpen: false });

slice.context.watch(
   'ui',
   this,
   (open) => {
      this.classList.toggle('open', open);
   },
   (state) => state.sidebarOpen
);
```

### Derived data with selectors

Use selectors to reduce re-renders and watch computed values.

```js
slice.context.watch(
   'cart',
   this,
   (count) => {
      this.$badge.textContent = count;
   },
   (state) => state.items.length
);
```

### Functional updates

Prefer functional updates when state depends on the previous value.

```js
slice.context.setState('cart', (prev) => ({
   ...prev,
   items: [...prev.items, item],
   total: prev.total + item.price,
}));
```

## Gotchas

-  Watchers require a valid Slice component (for auto-cleanup).
-  Selectors should be fast and side-effect free; they run on every update.
