import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSitemap,
  buildTranslatorContext,
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
  assert.match(head, /property="og:image:type" content="image\/png"/);
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
  assert.match(xml, /<loc>https:\/\/acme.dev\/a<\/loc>/);
  assert.match(xml, /<lastmod>2026-10-22<\/lastmod>/);
  assert.match(xml, /<priority>0.7<\/priority>/);
  // One field per line, so a <lastmod> change is a one-line diff.
  assert.match(xml, / {2}<url>\n {4}<loc>https:\/\/acme\.dev\/a<\/loc>\n/);
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

test('validation warns when routes.js and seo.json disagree on a title', () => {
  const { warnings } = validateSeoManifest(
    {
      version: 1,
      origin: ORIGIN,
      defaults: { titleTemplate: '%s | Acme' },
      routes: { '/pricing': { title: 'Pricing' } }
    },
    // The client has no manifest, so it renders "Pricing"; the server sends
    // "Pricing | Acme". The tab title would change after hydration.
    { routes: [{ path: '/pricing', metadata: { title: 'Pricing' } }] }
  );
  assert.ok(warnings.some((message) => /route title differs from seo\.json: \/pricing/.test(message)));
});

test('validation stays quiet when the route repeats the manifest title', () => {
  const { warnings } = validateSeoManifest(
    {
      version: 1,
      origin: ORIGIN,
      defaults: { titleTemplate: '%s | Acme' },
      routes: { '/pricing': { title: 'Pricing' } }
    },
    { routes: [{ path: '/pricing', metadata: { title: 'Pricing', titleTemplate: '%s | Acme' } }] }
  );
  assert.equal(warnings.filter((message) => /title differs/.test(message)).length, 0);
});

// -- Translator (feature 0003, phase 5) -------------------------------

const ES = {
  seo: { titleTemplate: '%s | Acme', description: 'Acme en espa�ol.' },
  home: { title: 'Inicio' },
  pricing: { title: 'Precios', description: 'Planes.' },
  count: { one: '{count} plan', other: '{count} planes' }
};
const EN = {
  seo: { titleTemplate: '%s | Acme', description: 'Acme in English.' },
  home: { title: 'Home' },
  pricing: { title: 'Pricing', description: 'Plans.' },
  count: { one: '{count} plan', other: '{count} plans' }
};

const translatorContext = (routing = 'prefix-except-default') => buildTranslatorContext(
  { enabled: true, defaultLocale: 'es', fallbackLocale: 'en', locales: ['es', 'en'], routing },
  { es: ES, en: EN }
);

test('translator context: lookup, fallback, plurals and the key when missing', () => {
  const translator = translatorContext();

  assert.equal(translator.enabled, true);
  assert.deepEqual(translator.locales, ['es', 'en']);
  assert.equal(translator.t('es', 'pricing.title'), 'Precios');
  assert.equal(translator.t('en', 'pricing.title'), 'Pricing');
  // Missing in `es`, present in the fallback: the fallback answers, as in the browser.
  assert.equal(translator.t('es', 'en.only'), 'en.only');
  assert.equal(translator.t('es', 'count', { count: 3 }), '3 planes');
  assert.equal(translator.t('es', 'count', { count: 1 }), '1 plan');
  assert.equal(translator.t('es', 'nope.key'), 'nope.key');
  assert.equal(translator.has('es', 'pricing.title'), true);
  assert.equal(translator.has('es', 'nope.key'), false);
});

test('translator context: URLs follow the routing mode', () => {
  const prefixed = translatorContext('prefix');
  assert.equal(prefixed.localize('/pricing', 'es'), '/es/pricing');
  assert.equal(prefixed.localize('/pricing', 'en'), '/en/pricing');
  assert.deepEqual(prefixed.split('/en/pricing?x=1'), { locale: 'en', path: '/pricing?x=1' });

  const exceptDefault = translatorContext('prefix-except-default');
  assert.equal(exceptDefault.localize('/pricing', 'es'), '/pricing');
  assert.equal(exceptDefault.localize('/pricing', 'en'), '/en/pricing');
  assert.equal(exceptDefault.localeOf('/pricing'), 'es');
  assert.equal(exceptDefault.localeOf('/en/pricing'), 'en');

  const off = translatorContext(false);
  assert.equal(off.localize('/pricing', 'en'), '/pricing');
  assert.deepEqual(off.split('/en/pricing'), { locale: null, path: '/en/pricing' });
});

test('resolveMetadata resolves { t } fields and canonicalizes the localized URL', () => {
  const translator = translatorContext();
  const translated = {
    title: { t: 'pricing.title' },
    description: { t: 'pricing.description' },
    titleTemplate: '%s | Acme'
  };

  const es = resolveMetadata({
    pathname: '/pricing',
    routeMetadata: translated,
    manifest: {},
    origin: ORIGIN,
    translate: (key, params) => translator.t('es', key, params),
    url: '/pricing'
  });
  assert.equal(es.title, 'Precios | Acme');
  assert.equal(es.description, 'Planes.');
  assert.equal(es.canonical, 'https://acme.dev/pricing');

  const en = resolveMetadata({
    pathname: '/pricing',
    routeMetadata: translated,
    manifest: {},
    origin: ORIGIN,
    translate: (key, params) => translator.t('en', key, params),
    url: '/en/pricing'
  });
  assert.equal(en.title, 'Pricing | Acme');
  assert.equal(en.canonical, 'https://acme.dev/en/pricing');
});

test('renderHead writes the hreflang alternates and injectHead sets lang/dir', () => {
  const head = renderHead(
    { title: 'Precios', robots: 'index, follow', openGraph: {}, twitter: {} },
    {
      locale: 'es_ES',
      alternates: [
        { hreflang: 'es', href: 'https://acme.dev/pricing' },
        { hreflang: 'en', href: 'https://acme.dev/en/pricing' },
        { hreflang: 'x-default', href: 'https://acme.dev/pricing' }
      ]
    }
  );
  assert.match(head, /property="og:locale" content="es_ES"/);
  assert.match(head, /rel="alternate" hreflang="es" href="https:\/\/acme.dev\/pricing"/);
  assert.match(head, /rel="alternate" hreflang="x-default" href="https:\/\/acme.dev\/pricing"/);

  const html = injectHead('<html lang="en"><head><title>x</title></head><body></body></html>', '<title>y</title>', {
    lang: 'es',
    dir: 'rtl'
  });
  assert.match(html, /<html lang="es" dir="rtl">/);
});

test('buildSitemap emits one URL per locale, with alternates and x-default', () => {
  const translator = translatorContext();
  const sitemap = buildSitemap({
    translator,
    origin: ORIGIN,
    manifest: {
      version: 1,
      origin: ORIGIN,
      routes: {
        '/': { title: 'Home' },
        '/pricing': { title: 'Pricing' }
      }
    }
  });

  assert.match(sitemap, /xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml"/);
  assert.equal((sitemap.match(/<url>/g) || []).length, 4);
  assert.match(sitemap, /<loc>https:\/\/acme.dev\/pricing<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/acme.dev\/en\/pricing<\/loc>/);
  assert.match(sitemap, /hreflang="en" href="https:\/\/acme.dev\/en\/pricing"/);
  assert.match(sitemap, /hreflang="x-default" href="https:\/\/acme.dev\/pricing"/);
});

test('validateSeoManifest reports a { t } key missing in one locale', () => {
  const translator = translatorContext();
  const manifest = {
    version: 1,
    origin: ORIGIN,
    defaults: { description: { t: 'seo.description' } },
    routes: {
      '/pricing': { title: { t: 'pricing.title' } },
      '/missing': { title: { t: 'not.in.any.locale' } }
    }
  };

  const result = validateSeoManifest(manifest, { translator });
  assert.ok(result.errors.some((error) => /missing translation "not\.in\.any\.locale" for "es"/.test(error)));
  assert.ok(result.errors.some((error) => /missing translation "not\.in\.any\.locale" for "en"/.test(error)));
  assert.equal(result.errors.some((error) => /pricing\.title/.test(error)), false);
});
