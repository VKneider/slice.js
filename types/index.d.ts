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
  path: string;
  component: string;
  params: Record<string, string>;
  query: Record<string, string>;
  metadata: Record<string, unknown>;
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
  navigate(path: string, redirectChain?: string[], options?: { replace?: boolean }): Promise<void>;
  matchRoute(path: string): RouteMatch;
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
  debugger?: SliceDebuggerApi;
  eventsDebugger?: SlicePanelDebuggerApi;
  contextDebugger?: SlicePanelDebuggerApi;
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
