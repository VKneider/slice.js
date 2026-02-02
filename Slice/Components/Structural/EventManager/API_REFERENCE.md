# EventManager API Reference

## Overview

`EventManager` provides a lightweight pub/sub system for Slice.js. It supports global subscriptions, component-bound subscriptions with auto-cleanup, and `once` subscriptions.

## Initialization

The instance is created dynamically by Slice when `sliceConfig.events.enabled` is `true`.

```js
// sliceConfig.json
{
  "events": { "enabled": true }
}
```

If enabled, Slice loads and instantiates it, then calls `init()` when present.

## API

### `init()`

Optional initialization hook. Returns `true` by default.

### `subscribe(eventName, callback, options?)`

Subscribe to an event.

-  `eventName` (string) Event name.
-  `callback` (Function) Handler called with emitted data.
-  `options` (Object, optional)
   -  `component` (Slice component) Enables auto-cleanup on component destroy.

Returns a `subscriptionId` string or `null` if invalid.

```js
const id = slice.events.subscribe('user:login', (user) => {
   console.log(user);
});
```

### `subscribeOnce(eventName, callback, options?)`

Subscribe to an event once. After the first emit, the subscription is removed.

```js
slice.events.subscribeOnce('app:ready', () => {
   console.log('ready');
});
```

### `unsubscribe(eventName, subscriptionId)`

Remove a subscription.

Returns `true` if removed, otherwise `false`.

```js
slice.events.unsubscribe('user:login', id);
```

### `emit(eventName, data?)`

Emit an event to all subscribers.

```js
slice.events.emit('cart:updated', { items: 3 });
```

### `bind(component)`

Returns a component-bound API with auto-cleanup.

```js
this.events = slice.events.bind(this);
this.events.subscribe('user:logout', () => this.reset());
```

### `cleanupComponent(sliceId)`

Remove all subscriptions associated with a component.

```js
slice.events.cleanupComponent(component.sliceId);
```

### `hasSubscribers(eventName)`

Returns `true` if the event has active subscribers.

### `subscriberCount(eventName)`

Returns the number of subscribers for the event.

### `clear()`

Removes all subscriptions and resets internal state.

## Notes

-  When `events.enabled` is `false`, Slice provides a no-op implementation to avoid runtime errors.
-  Auto-cleanup happens when `Controller.destroyComponent()` is called.

## Usage Patterns

### Component-bound subscriptions (recommended)

Bind to a component so subscriptions clean up automatically.

```js
class Navbar extends HTMLElement {
   async init() {
      this.events = slice.events.bind(this);
      this.events.subscribe('user:login', (user) => this.renderUser(user));
   }
}
```

### One-time initialization

Use `subscribeOnce` for bootstrapping or single-shot flows.

```js
slice.events.subscribeOnce('app:ready', () => {
   console.log('App ready');
});
```

### Manual cleanup (when not bound)

If you subscribe without `bind`, you must unsubscribe in `beforeDestroy`.

```js
class Analytics extends HTMLElement {
   async init() {
      this.loginSub = slice.events.subscribe('user:login', (user) => this.track(user));
   }

   beforeDestroy() {
      slice.events.unsubscribe('user:login', this.loginSub);
   }
}
```

### Global notifications

Emit a global event from anywhere and let a UI component listen.

```js
slice.events.emit('notification:show', { type: 'success', message: 'Saved' });
```

## Gotchas

-  Prefer `bind()` for auto-cleanup; manual subscriptions leak if you forget to unsubscribe.
-  Keep payloads simple and serializable if you plan to persist or log them.
