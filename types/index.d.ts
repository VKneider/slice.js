export type SliceMode = 'development' | 'production' | string;

export interface RouteConfig {
  path: string;
  component: string;
  children?: RouteConfig[];
  metadata?: Record<string, unknown>;
  fullPath?: string;
  parentPath?: string | null;
  parentRoute?: RouteConfig | null;
}

export interface RouteInfo {
  /** The app path, without locale prefix: '/pricing'. */
  path: string;
  component: string;
  params: Record<string, string>;
  query: Record<string, string>;
  metadata: Record<string, unknown>;
  /** The locale of this navigation (null without slice.translator). */
  locale: string | null;
  /** What the address bar shows: '/en/pricing' with routing, '/pricing' without. */
  url: string;
}

export interface RouteMatch {
  route: RouteConfig | null;
  params: Record<string, string>;
  childRoute?: RouteConfig;
}

export type RouterNext = (arg?: void | false | string | { path: string; replace?: boolean }) => void;

export interface SliceControllerApi {
  componentCategories: Map<string, string>;
  templates: Map<string, HTMLTemplateElement>;
  classes: Map<string, new (...args: any[]) => HTMLElement>;
  requestedStyles: Set<string>;
  activeComponents: Map<string, HTMLElement>;
  getComponent(sliceId: string): HTMLElement | undefined;
  getComponentCategory(componentSliceId: string): string | undefined;
  fetchText(
    componentName: string,
    resourceType: 'html' | 'css' | 'theme' | 'styles',
    componentCategory?: string,
    customPath?: string
  ): Promise<string>;
  setComponentProps(component: HTMLElement, props: Record<string, unknown>): void;
  destroyComponent(components: HTMLElement | string | Array<HTMLElement | string>): number;
  destroyByContainer(container: HTMLElement): number;
  destroyByPattern(pattern: string | RegExp): number;
  findOrphans(): Array<{ sliceId: string; name: string; reason: string; retainPath: string[] }>;
  registerLeakExclusion(predicate: (component: HTMLElement) => boolean): void;
  sampleComponentGrowth(): void;
  isGrowthMonotonic(): boolean;
}

export interface SliceStylesManagerApi {
  componentStyles: HTMLStyleElement;
  themeManager?: SliceThemeManagerApi;
  init(): Promise<void>;
  appendComponentStyles(cssText: string): void;
  registerComponentStyles(componentName: string, cssText: string): void;
}

export interface SliceThemeManagerApi {
  currentTheme: string | null;
  applyTheme(themeName: string): Promise<void>;
}

export interface SliceLoggerApi {
  logError(componentSliceId: string, message: string, error?: unknown): void;
  logWarning(componentSliceId: string, message: string): void;
  logInfo(componentSliceId: string, message: string): void;
  getLogs(): unknown[];
  clearLogs(): void;
}

export interface SliceEventBindingApi {
  subscribe(eventName: string, callback: (data?: unknown) => void): string | null;
  subscribeOnce(eventName: string, callback: (data?: unknown) => void): string | null;
  emit(eventName: string, data?: unknown): void;
}

export interface SliceEventManagerApi {
  init(): boolean;
  subscribe(
    eventName: string,
    callback: (data?: unknown) => void,
    options?: { component?: HTMLElement }
  ): string | null;
  subscribeOnce(
    eventName: string,
    callback: (data?: unknown) => void,
    options?: { component?: HTMLElement }
  ): string | null;
  unsubscribe(eventName: string, subscriptionId: string): boolean;
  emit(eventName: string, ...data: unknown[]): void;
  bind(component: HTMLElement): SliceEventBindingApi | null;
  register(namespace: string, catalog: Record<string, { description?: string; payload?: unknown }>): SliceEventManagerApi;
  register(catalog: Record<string, { description?: string; payload?: unknown }>): SliceEventManagerApi;
  loadGraph(graph: { events: Record<string, unknown>; dynamic?: unknown }): SliceEventManagerApi;
  staticEmittersOf(eventName: string): Array<{ file: string; line: number; component: string | null }>;
  staticListenersOf(eventName: string): Array<{ file: string; line: number; component: string | null }>;
  isDeclared(eventName: string): boolean;
  namespaceOf(eventName: string): string | null;
  cleanupComponent(sliceId: string): number;
  hasSubscribers(eventName: string): boolean;
  subscriberCount(eventName: string): number;
  clear(): void;
}

export interface SliceContextOptions {
  persist?: boolean;
  storageKey?: string;
}

export interface SliceContextManagerApi {
  init(): boolean;
  create(name: string, initialState?: Record<string, unknown>, options?: SliceContextOptions): boolean;
  getState<T = unknown>(name: string): T | null;
  setState<T = unknown>(name: string, updater: T | ((prevState: T) => T)): void;
  watch<TSelected = unknown>(
    name: string,
    component: HTMLElement,
    callback: (value: TSelected) => void,
    selector?: (state: unknown) => TSelected
  ): string | null;
  has(name: string): boolean;
  destroy(name: string): boolean;
  list(): string[];
}

export interface SliceRouterApi {
  activeRoute: RouteConfig | null;
  pathToRouteMap: Map<string, RouteConfig>;
  init(): void;
  start(): Promise<void>;
  beforeEach(guard: (to: RouteInfo, from: RouteInfo, next: RouterNext) => void | Promise<void>): void;
  afterEach(guard: (to: RouteInfo, from: RouteInfo) => void): void;
  navigate(path: string, options?: { replace?: boolean; locale?: string }): Promise<void>;
  /** @deprecated legacy signature */
  navigate(path: string, redirectChain: string[], options?: { replace?: boolean; locale?: string }): Promise<void>;
  /** Strips a known locale prefix before matching. */
  matchRoute(path: string): RouteMatch;
  /** The current app path, without locale prefix. */
  readonly path: string;
  /** The URL for an app path in the active (or given) locale. */
  href(path: string, options?: { locale?: string }): string;
  /** Metadata of the route being shown (re-applied, translated, after a locale change). */
  activeMetadata: Record<string, unknown> | null;
  applyMetadata(metadata: Record<string, unknown> | null): void;
}

export type TranslatorParams = Record<string, string | number | TranslationKey>;

/** A key reference for a component prop, from `slice.translator.key()`. */
export interface TranslationKey {
  readonly key: string;
  readonly params?: Readonly<TranslatorParams>;
}

export interface TranslatorConfig {
  enabled?: boolean;
  defaultLocale?: string;
  fallbackLocale?: string | null;
  locales?: string[];
  path?: string;
  saveLocally?: boolean;
  useBrowserLocale?: boolean;
  routing?: false | 'prefix' | 'prefix-except-default';
}

export interface SliceTranslatorFormatApi {
  number(value: number, options?: Intl.NumberFormatOptions): string;
  currency(value: number, currency: string, options?: Intl.NumberFormatOptions): string;
  percent(value: number, options?: Intl.NumberFormatOptions): string;
  date(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string;
  time(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string;
  relative(value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions): string;
  list(items: string[], options?: Intl.ListFormatOptions): string;
}

export interface SliceTranslatorApi {
  readonly enabled: boolean;
  /** The active locale, e.g. 'es'. */
  readonly locale: string;
  readonly locales: readonly string[];
  readonly defaultLocale: string;
  readonly fallbackLocale: string | null;
  readonly format: SliceTranslatorFormatApi;
  /** Translate a key; returns the key when it is missing (or the translator is off). */
  t(key: string, params?: TranslatorParams): string;
  has(key: string, locale?: string): boolean;
  /** Merge messages; `{ defaults: true }` adds a layer the app's dictionaries always override. */
  add(locale: string, messages: Record<string, unknown>, options?: { defaults?: boolean }): void;
  /** Load `<path>/<locale>/<namespace>.json` for the active locale and the fallback. */
  load(namespace: string): Promise<void>;
  setLocale(locale: string): Promise<string>;
  /** Load a locale's dictionaries without switching to it; resolves to the configured locale. */
  preload(locale: string): Promise<string>;
  readonly routing: false | 'prefix' | 'prefix-except-default';
  /** '/en/pricing' → { locale: 'en', path: '/pricing' } (whole URL, locale null, without routing). */
  splitPath(url: string): { locale: string | null; path: string };
  /** The URL of an app path in a locale (default: the active one). */
  localizePath(path: string, locale?: string): string;
  /** The locale a URL stands for; null without routing. */
  localeOfUrl(url: string): string | null;
  /** Rewrite the address bar to the active locale (replaceState). */
  syncUrl(): void;
  /** A key reference for a component prop: resolved before the component sees it, refreshed on a locale change. */
  key(key: string, params?: TranslatorParams): TranslationKey;
  isKey(value: unknown): boolean;
  resolve<T = unknown>(value: T): T;
  /** Translate every `data-t` element under `root` (default: the document) right now. */
  apply(root?: ParentNode): number;
  /** Called after every locale change; with a component, until it is destroyed. Returns an unsubscribe function. */
  watch(component: object, callback: (locale: string, previous: string) => void): () => void;
  watch(callback: (locale: string, previous: string) => void): () => void;
  forget(component: object): void;
}

export interface SlicePanelDebuggerApi {
  init(): Promise<void>;
  toggle(): void;
  open(): void;
  close(): void;
}

export interface SliceDebuggerApi {
  enableDebugMode(): Promise<boolean>;
  attachDebugMode(component: HTMLElement): void;
  hide(): void;
}

export interface SliceLoadingApi {
  start?: () => void;
  stop?: () => void;
}

export interface SlicePaths {
  routesFile?: string;
  themes?: string;
  styles?: string;
  structuralComponentFolderPath?: string;
  components?: Record<string, { path: string; type?: string }>;
  [key: string]: unknown;
}

export interface SliceFrameworkClasses {
  Controller?: new () => SliceControllerApi;
  StylesManager?: new () => SliceStylesManagerApi;
  Router?: new (routes: RouteConfig[]) => SliceRouterApi;
  Logger?: new () => SliceLoggerApi;
  EventManager?: new () => SliceEventManagerApi;
  ContextManager?: new () => SliceContextManagerApi;
  Debugger?: new () => SliceDebuggerApi;
  EventManagerDebugger?: new () => SlicePanelDebuggerApi;
  ContextManagerDebugger?: new () => SlicePanelDebuggerApi;
  ThemeManager?: new () => SliceThemeManagerApi;
  Translator?: new (config?: TranslatorConfig) => SliceTranslatorApi;
  [key: string]: unknown;
}

export interface SliceApi {
  frameworkClasses: SliceFrameworkClasses | null;
  controller: SliceControllerApi;
  stylesManager: SliceStylesManagerApi;
  logger: SliceLoggerApi;
  router: SliceRouterApi;
  events: SliceEventManagerApi;
  context: SliceContextManagerApi;
  translator: SliceTranslatorApi;
  debugger?: SliceDebuggerApi;
  eventsDebugger?: SlicePanelDebuggerApi;
  contextDebugger?: SlicePanelDebuggerApi;
  leakInspector?: SlicePanelDebuggerApi;
  loading?: SliceLoadingApi;
  paths: SlicePaths;
  _mode: SliceMode;
  getClass<T = unknown>(module: string): Promise<T | undefined>;
  isProduction(): boolean;
  getEnv(name: string, fallbackValue?: string): string | undefined;
  getPublicEnv(): Record<string, string>;
  getComponent(componentSliceId: string): HTMLElement | undefined;
  build<T = HTMLElement>(componentName: string, props?: Record<string, unknown>): Promise<T | null>;
  setTheme(themeName: string): Promise<void>;
  readonly theme: string | null;
  attachTemplate(componentInstance: HTMLElement): void;
  /** Shortcut of `slice.translator.t()`. */
  t(key: string, params?: TranslatorParams): string;
}

declare class Slice {
  constructor(sliceConfig: Record<string, unknown>, frameworkClasses?: SliceFrameworkClasses | null);
}

export default Slice;

declare global {
  interface Window {
    slice: SliceApi;
  }

  const slice: SliceApi;
}
