import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};

const { default: Slice } = await import('../Slice.js');

class FakeController {
  constructor() {
    this.componentCategories = new Map();
    this.templates = new Map();
    this.classes = new Map();
    this.requestedStyles = new Set();
    this.loadedBundles = new Set();
    this.activeComponents = new Map();
    this.bundleLoads = 0;
  }

  getBundleForComponent(componentName) {
    return componentName === 'DocumentationPage' ? 'multiroute-DocumentationPage--p1' : null;
  }

  async loadBundle(bundleName) {
    this.bundleLoads += 1;
    this.loadedBundles.add(bundleName);
    this.classes.set(
      'DocumentationPage',
      class DocumentationPage {
        constructor(props) {
          this.props = props;
          this.sliceId = 'DocumentationPage';
        }
        async init() {}
      }
    );
  }

  isComponentFromBundle(componentName) {
    return componentName === 'DocumentationPage' && this.loadedBundles.has('multiroute-DocumentationPage--p1');
  }

  verifyComponentIds() {
    return true;
  }

  registerComponent() {}

  registerComponentsRecursively() {}
}

class FakeStylesManager {
  registerComponentStyles() {}
}

function createSlice() {
  const instance = new Slice(
    {
      paths: {
        components: {
          AppComponents: {
            path: '/Components/AppComponents',
            type: 'Visual'
          }
        }
      },
      themeManager: {},
      stylesManager: {},
      logger: {},
      debugger: { enabled: false },
      loading: {},
      events: {}
    },
    {
      Controller: FakeController,
      StylesManager: FakeStylesManager
    }
  );

  instance.logger = {
    logError() {},
    logWarning() {},
    logInfo() {}
  };

  return instance;
}

test('build succeeds for bundled component even when componentCategories is missing entry', async () => {
  const originalSlice = globalThis.slice;

  try {
    const sliceInstance = createSlice();
    globalThis.slice = sliceInstance;

    const component = await sliceInstance.build('DocumentationPage', { from: 'route' });

    assert.ok(component);
    assert.equal(component.sliceId, 'DocumentationPage');
    assert.equal(sliceInstance.controller.bundleLoads, 1);
  } finally {
    globalThis.slice = originalSlice;
  }
});
