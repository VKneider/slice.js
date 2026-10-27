/**
 * Apply a route's `metadata` to the document head.
 *
 * Only what the route declares is touched. A route without `metadata.title`
 * keeps whatever the server sent: with native SEO the prerendered HTML already
 * carries the right title, and writing a generic one here would undo it.
 *
 * `canonical` and `robots` are deliberately **never** written from here.
 * Crawlers do not run this code, so rewriting them client-side could only
 * desync the SPA from the HTML that was actually served.
 *
 * @param {Object|null} metadata route metadata (`metadata.title`, ...)
 * @param {Document|null} doc injectable for tests
 * @returns {void}
 */
export function applyRouteMetadata(metadata, doc = typeof document !== 'undefined' ? document : null) {
   if (!doc || !metadata || typeof metadata !== 'object') return;

   const { title, titleTemplate, description } = metadata;

   if (title) {
      const next = titleTemplate && titleTemplate !== '%s'
         ? titleTemplate.replace('%s', String(title))
         : String(title);
      if (doc.title !== next) doc.title = next;
   }

   if (description) {
      let meta = doc.querySelector('meta[name="description"]');
      if (!meta) {
         meta = doc.createElement('meta');
         meta.setAttribute('name', 'description');
         doc.head.appendChild(meta);
      }
      if (meta.getAttribute('content') !== description) {
         meta.setAttribute('content', description);
      }
   }
}
