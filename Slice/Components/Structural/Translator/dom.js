/**
 * `data-t` in the DOM: which texts an element gets, and writing them.
 *
 *   <h1 data-t="home.title"></h1>                     text ← home.title
 *   <input data-t="home.search" placeholder>          placeholder ← home.search.placeholder
 *   <button data-t="cart.count" data-t-count="3">     text ← cart.count with { count: 3 }
 *   <p data-t="signup.terms">                         "Acepto los {link}." rebuilt around
 *     <a data-t-slot="link" data-t="signup.link"></a>  the slot element, which keeps its
 *   </p>                                               attributes and listeners
 *
 * `templateKeys()` is the rule the CLI reuses (`slice translator check`) to know which keys
 * a template needs, so the two cannot drift.
 */

/** Attributes translated when present on an element with `data-t`, by tag ('*' = any). */
export const TRANSLATABLE_ATTRIBUTES = Object.freeze({
   placeholder: '*',
   title: '*',
   alt: '*',
   'aria-label': '*',
   'aria-description': '*',
   'aria-placeholder': '*',
   'aria-roledescription': '*',
   'aria-valuetext': '*',
   label: ['OPTION', 'OPTGROUP', 'TRACK'],
   value: ['INPUT'],
});

/** `data-t-*` names that are directives, not message params. */
export const RESERVED_PARAMS = Object.freeze(['text', 'slot']);

/** Elements that never hold text. */
const VOID_ELEMENTS = new Set([
   'AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR',
   'SELECT',
]);

const INPUT_VALUE_TYPES = new Set(['button', 'submit', 'reset']);

const SLOT_MARK = '\u0000';
const SLOT_PATTERN = /\u0000slot:([^\u0000]+)\u0000/;

/**
 * `aria-label` → `ariaLabel`; `user-name` → `userName`.
 * @param {string} name
 * @returns {string}
 */
export function camelCase(name) {
   return name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Translatable attributes present on an element (even empty).
 * @param {{ tagName: string, hasAttribute(name: string): boolean, getAttribute(name: string): string|null }} element
 * @returns {string[]}
 */
export function translatableAttributes(element) {
   const tag = String(element.tagName || '').toUpperCase();
   const found = [];
   for (const [attribute, tags] of Object.entries(TRANSLATABLE_ATTRIBUTES)) {
      if (!element.hasAttribute(attribute)) continue;
      if (tags !== '*' && !tags.includes(tag)) continue;
      if (attribute === 'value' && !INPUT_VALUE_TYPES.has(String(element.getAttribute('type') || '').toLowerCase())) {
         continue;
      }
      found.push(attribute);
   }
   return found;
}

/**
 * The keys an element with `data-t` needs: its text (unless it only fills attributes) and
 * `key.<attribute>` for each translatable attribute present.
 * @param {{ tagName: string, hasAttribute(name: string): boolean, getAttribute(name: string): string|null }} element
 * @returns {{ key: string, text: string|null, attributes: Record<string, string> }|null}
 */
export function templateKeys(element) {
   const key = (element.getAttribute('data-t') || '').trim();
   if (!key) return null;
   /** @type {Record<string, string>} */
   const attributes = {};
   const present = translatableAttributes(element);
   for (const attribute of present) attributes[attribute] = `${key}.${camelCase(attribute)}`;
   const tag = String(element.tagName || '').toUpperCase();
   const fillsText = !VOID_ELEMENTS.has(tag) && (present.length === 0 || element.hasAttribute('data-t-text'));
   return { key, text: fillsText ? key : null, attributes };
}

/**
 * Message params from `data-t-*` attributes: `data-t-count="3"` → `{ count: 3 }`.
 * Numeric strings become numbers so plurals and number formatting work.
 * @param {Element} element
 * @returns {Record<string, string|number>}
 */
export function paramsOf(element) {
   /** @type {Record<string, string|number>} */
   const params = {};
   for (const { name, value } of Array.from(element.attributes)) {
      if (!name.startsWith('data-t-')) continue;
      const param = name.slice(7);
      if (!param || RESERVED_PARAMS.includes(param)) continue;
      params[camelCase(param)] = /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : value;
   }
   return params;
}

/**
 * Elements under `root` (and `root` itself) that carry `data-t`.
 * @param {ParentNode & Partial<Element>} root
 * @returns {Element[]}
 */
export function translatableIn(root) {
   const list = [];
   if (root && typeof root.hasAttribute === 'function' && root.hasAttribute('data-t')) list.push(/** @type {Element} */ (root));
   if (root && typeof root.querySelectorAll === 'function') list.push(...root.querySelectorAll('[data-t]'));
   return list;
}

/**
 * @typedef {Object} DomContext
 * @property {(key: string, params?: Record<string, any>) => string} t
 * @property {() => string} signature  locale + dictionary version, to skip elements already up to date
 * @property {WeakMap<Element, string>} applied
 * @property {WeakMap<Element, Map<string, Element>>} slots
 * @property {(message: string) => void} [warn]
 */

/**
 * Translate one element. Skips it when nothing changed since the last pass (same locale,
 * dictionaries, key and params), so the observer and explicit passes can overlap freely.
 * @param {Element} element
 * @param {DomContext} context
 * @returns {boolean} whether something was written
 */
export function translateElement(element, context) {
   const keys = templateKeys(element);
   if (!keys) return false;

   const params = paramsOf(element);
   const stamp = `${context.signature()}|${keys.key}|${JSON.stringify(params)}|${Object.keys(keys.attributes).join(',')}|${keys.text ? 1 : 0}`;
   if (context.applied.get(element) === stamp) return false;
   context.applied.set(element, stamp);

   for (const [attribute, key] of Object.entries(keys.attributes)) {
      const text = context.t(key, params);
      if (element.getAttribute(attribute) !== text) element.setAttribute(attribute, text);
   }

   if (keys.text) {
      writeText(element, keys.key, params, context);
   } else if (Object.keys(keys.attributes).length === 0) {
      context.warn?.(`data-t="${keys.key}" on <${element.tagName.toLowerCase()}> has nothing to fill: add a translatable attribute (placeholder, aria-label…)`);
   }
   return true;
}

/**
 * Translate every `data-t` element under `root`.
 * @param {ParentNode} root
 * @param {DomContext} context
 * @returns {number} elements written
 */
export function translateTree(root, context) {
   let written = 0;
   for (const element of translatableIn(root)) {
      if (translateElement(element, context)) written++;
   }
   return written;
}

/**
 * @param {Element} element
 * @param {string} key
 * @param {Record<string, any>} params
 * @param {DomContext} context
 */
function writeText(element, key, params, context) {
   const slots = slotsOf(element, context);

   if (slots.size > 0) {
      /** @type {Record<string, any>} */
      const withSlots = { ...params };
      for (const name of slots.keys()) withSlots[name] = `${SLOT_MARK}slot:${name}${SLOT_MARK}`;
      const message = context.t(key, withSlots);
      const nodes = [];
      const used = new Set();
      const parts = message.split(SLOT_PATTERN);
      // split with a capture group alternates: text, slot name, text, slot name, …
      parts.forEach((part, index) => {
         if (index % 2 === 0) {
            if (part) nodes.push(element.ownerDocument.createTextNode(part));
            return;
         }
         const slot = slots.get(part);
         if (slot && !used.has(part)) {
            used.add(part);
            nodes.push(slot);
         }
      });
      element.replaceChildren(...nodes);
      for (const [name, slot] of slots) {
         if (used.has(name)) slot.__sliceSlotDetached = false;
         else if (!slot.isConnected) slot.__sliceSlotDetached = true;
      }
      return;
   }

   const text = context.t(key, params);
   if (element.children.length === 0) {
      if (element.textContent !== text) element.textContent = text;
      return;
   }

   // Child elements without data-t-slot (an icon in a button): keep them and replace only
   // the element's own text, where the first visible text was (or at the end).
   const ownText = Array.from(element.childNodes).filter((node) => node.nodeType === 3);
   const anchor = ownText.find((node) => (node.textContent || '').trim() !== '');
   if (anchor && ownText.filter((node) => (node.textContent || '').trim() !== '').length === 1 && anchor.textContent === text) {
      return;
   }
   const node = element.ownerDocument.createTextNode(text);
   if (anchor) element.insertBefore(node, anchor);
   else element.appendChild(node);
   for (const old of ownText) if ((old.textContent || '').trim() !== '') old.remove();
}

/**
 * Slot elements of `element`: descendants with `data-t-slot` whose closest `data-t`
 * ancestor is `element`. Remembered, so a locale whose message omits a slot does not lose
 * it for the next locale.
 * @param {Element} element
 * @param {DomContext} context
 * @returns {Map<string, Element>}
 */
function slotsOf(element, context) {
   let slots = context.slots.get(element);
   if (!slots) slots = new Map();
   const present = new Map();
   for (const candidate of element.querySelectorAll('[data-t-slot]')) {
      if (candidate.parentElement?.closest('[data-t]') !== element) continue;
      const name = candidate.getAttribute('data-t-slot');
      if (!name) continue;
      present.set(name, candidate);
   }
   // A slot the app removed is gone; one this helper detached to show a message without
   // it is kept for the next locale (that is why the cache exists).
   for (const [name, node] of slots) {
      if (!node.isConnected && !node.__sliceSlotDetached) slots.delete(name);
   }
   for (const [name, node] of present) slots.set(name, node);
   if (slots.size) context.slots.set(element, slots);
   return slots;
}
