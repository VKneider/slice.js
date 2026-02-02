# Router API Reference

## Overview

`Router` handles client-side navigation for Slice.js. It supports navigation guards, nested routes, and route containers. It now emits a route change event through `EventManager` when enabled, or a browser `CustomEvent` when not.

## Route Change Events

### EventManager (preferred)

When `sliceConfig.events.enabled` is `true`, the router emits an event:

```js
slice.events.subscribe('router:change', ({ to, from }) => {
   console.log('Route changed:', from.path, '→', to.path);
});
```

### Browser CustomEvent (fallback)

When `events` is disabled, the router dispatches a `CustomEvent` on `window`:

```js
window.addEventListener('router:change', (event) => {
   const { to, from } = event.detail;
   console.log('Route changed:', from.path, '→', to.path);
});
```

## Event Payload

The payload matches the guard route info format.

```js
{
  to: {
    path,
    component,
    params,
    query,
    metadata
  },
  from: {
    path,
    component,
    params,
    query,
    metadata
  }
}
```

## Notes

-  The event fires after the route is rendered and after `afterEach` guard.
-  Use `EventManager` for component-bound subscriptions with auto-cleanup.
