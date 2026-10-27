import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSitemap,
  injectHead,
  matchPathPattern,
  normalizeOrigin,
  pickRouteEntry,
  renderHead,
  resolveMetadata,
  serializeJsonLd,
  validateSeoManifest
} from './seo.js';

const ORIGIN = 'https://acme.dev';

const manifest = () => ({
  version: 1,
  origin: ORIGIN,
  defaults: {
    titleTemplate: '%s | Acme',
    description: 'Acme docs.',
    siteName: 'Acme',
    locale: 'en_US',
    image: '/images/banner.png'
  },
  routes: {
    '/': { title: 'Home', titleTemplate: '%s' },
    '/pricing': { title: 'Pricing', description: 'Plans.' },
    '/private': { title: 'Private', robots: false },
    '/producto/${id}': { title: 'Producto', image: '/og/producto.png' }
  }
});

test('origin must be absolute and has no trailing slash', () => {
  assert.equal(normalizeOrigin('https://acme.dev/'), 'https://acme.dev');
  assert.equal(normalizeOrigin('https://acme.dev///'), 'https://acme.dev');
  assert.equal(normalizeOrigin('/relative'), null);
  assert.equal(normalizeOrigin(''), null);
});

test('a ${param} route matches one segment and nothing deeper', () => {
  assert.deepEqual(matchPathPattern('/producto/${id}', '/producto/42'), { id: '42' });
  assert.equal(matchPathPattern('/producto/${id}', '/producto/42/detalle'), null);
  assert.equal(matchPathPattern('/producto/${id}', '/otro/42'), null);
  // Dots and slashes in a literal pattern must not become regex magic.
  assert.equal(matchPathPattern('/a.b', '/axb'), null);
});

test('a literal entry beats a pattern, and the longest pattern wins', () => {
  const data = {
    routes: {
      '/p/${id}': { title: 'short' },
      '/p/${id}/detail': { title: 'long' },
      '/p/42': { title: 'literal' }
    }
  };
  assert.equal(pickRouteEntry('/p/42', data).entry.title, 'literal');
  assert.equal(pickRouteEntry('/p/7/detail', data).entry.title, 'long');
  assert.equal(pickRouteEntry('/p/7', data).entry.title, 'short');
  assert.equal(pickRouteEntry('/nope', data), null);
});

test('metadata resolves defaults -> pattern -> inline, with the real path as canonical', () => {
  const meta = resolveMetadata({
    pathname: '/producto/42',
    manifest: manifest(),
    origin: ORIGIN,
    routeMetadata: { description: 'Inline wins.' }
  });

  assert.equal(meta.title, 'Producto | Acme');
  assert.equal(meta.description, 'Inline wins.');
  // The canonical is the requested path, never the pattern.
  assert.equal(meta.canonical, `${ORIGIN}/producto/42`);
  assert.equal(meta.image, `${ORIGIN}/og/producto.png`);
  assert.equal(meta.indexable, true);
  assert.equal(meta.robots, 'index, follow');
});

test('a template of "%s" opts a route out of the suffix', () => {
  const meta = resolveMetadata({ pathname: '/', manifest: manifest(), origin: ORIGIN });
  assert.equal(meta.title, 'Home');
  assert.equal(meta.canonical, `${ORIGIN}/`);
});

test('robots: false means noindex and not indexable', () => {
  const meta = resolveMetadata({ pathname: '/private', manifest: manifest(), origin: ORIGIN });
  assert.equal(meta.robots, 'noindex, nofollow');
  assert.equal(meta.indexable, false);
});

test('the head escapes everything it interpolates', () => {
  const meta = resolveMetadata({
    pathname: '/pricing',
    manifest: manifest(),
    origin: ORIGIN,
    routeMetadata: { title: 'A & B <tag> "q"', description: "it's" }
  });
  const head = renderHead(meta, { siteName: 'Acme', locale: 'en_US' });

  assert.match(head, /<title>A &amp; B &lt;tag&gt; &quot;q&quot; \| Acme<\/title>/);
  assert.match(head, /content="it&#39;s"/);
  assert.match(head, /property="og:site_name" content="Acme"/);
  assert.match(head, /name="twitter:card" content="summary_large_image"/);
  assert.match(head, /property="og:image" content="https:\/\/acme.dev\/images\/banner.png"/);
});

test('JSON-LD gets a context and cannot close its own script tag', () => {
  const html = serializeJsonLd({ '@type': 'TechArticle', headline: '</script><x>' });
  assert.match(html, /"@context":"https:\/\/schema\.org"/);
  assert.doesNotMatch(html, /<\/script><x>/);
  assert.match(html, /\\u003c\/script>/);
});

test('injectHead replaces the shell tags instead of stacking them', () => {
  const shell = `<!DOCTYPE html><html><head>
    <title>Old</title>
    <meta name="description" content="old" />
    <link rel="canonical" href="https://old/" />
    <meta property="og:title" content="old" />
    <meta property="og:image" content="https://old/x.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="robots" content="noindex" />
    <meta name="viewport" content="width=device-width" />
    <script type="application/ld+json">{"@type":"WebSite"}</script>
  </head><body><div id="app"></div></body></html>`;

  const meta = resolveMetadata({ pathname: '/pricing', manifest: manifest(), origin: ORIGIN });
  const html = injectHead(shell, renderHead(meta, { siteName: 'Acme' }));

  assert.doesNotMatch(html, /Old/);
  assert.doesNotMatch(html, /https:\/\/old\//);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.match(html, /<title>Pricing \| Acme<\/title>/);
  assert.match(html, /name="viewport"/);
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.doesNotMatch(html, /"@type":"WebSite"/);
});

test('the sitemap lists literal indexable routes only, sorted and escaped', () => {
  const data = {
    version: 1,
    origin: ORIGIN,
    routes: {
      '/z': { title: 'Z' },
      '/a': { title: 'A', sitemap: { lastmod: '2026-10-22', priority: 0.7 } },
      '/private': { robots: false },
      '/hidden': { sitemap: false },
      '/producto/${id}': { title: 'Producto' }
    }
  };
  const xml = buildSitemap({ manifest: data, origin: ORIGIN });

  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/acme.dev\/a<\/loc><lastmod>2026-10-22<\/lastmod><priority>0.7<\/priority>/);
  assert.ok(xml.indexOf('/a</loc>') < xml.indexOf('/z</loc>'), 'sorted by URL');
  assert.doesNotMatch(xml, /private|hidden|producto/);
  assert.throws(() => buildSitemap({ manifest: data, origin: '/relative' }), /absolute origin/);
});

test('validation reports the mistakes and the soft ones', () => {
  const { errors, warnings } = validateSeoManifest(
    {
      version: 2,
      origin: 'https://acme.dev/',
      routes: {
        'no-slash': { title: 'x' },
        '/trailing/': { title: 'x' },
        '/gone': { title: 'x', image: '/og/missing.png' },
        '/long': { title: 'x'.repeat(80), description: 'y'.repeat(200) },
        '/unlisted': { title: 'x', sitemap: false }
      }
    },
    { fileExists: () => false, publicDir: '/public' }
  );

  assert.ok(errors.some((message) => /unsupported version/.test(message)));
  assert.ok(errors.some((message) => /must not end with a slash/.test(message)));
  assert.ok(errors.some((message) => /must start with/.test(message)));
  assert.ok(errors.some((message) => /image not found/.test(message)));
  assert.ok(warnings.some((message) => /title longer than/.test(message)));
  assert.ok(warnings.some((message) => /description longer than/.test(message)));
  assert.ok(warnings.some((message) => /indexable page excluded/.test(message)));
});

test('validation cross-checks routes.js both ways', () => {
  const { warnings } = validateSeoManifest(
    { version: 1, origin: ORIGIN, routes: { '/pricing': { title: 'Pricing' }, '/ghost': { title: 'Ghost' } } },
    { routes: [{ path: '/pricing' }, { path: '/about' }] }
  );
  assert.ok(warnings.some((message) => /route has no metadata: \/about/.test(message)));
  assert.ok(warnings.some((message) => /metadata entry has no route: \/ghost/.test(message)));
});
