import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.alert = () => {};

const { default: Slice } = await import('../Slice.js');

class FakeController {
  constructor() {
    this.componentCategories = new Map([
      ['MultiRoute', 'Visual'],
      ['Route', 'Visual'],
      ['Link', 'Visual'],
      ['Button', 'Visual']
    ]);
    this.templates = new Map();
    this.classes = new Map();
    this.requestedStyles = new Set();
    this.loadedBundles = new Set();
    this.activeComponents = new Map();
    this.fetchCalls = 0;
  }

  getBundleForComponent() {
    return null;
  }

  isComponentFromBundle() {
    return false;
  }

  async fetchText() {
    this.fetchCalls += 1;
    throw new Error('fetchText should not be called for js-only visual components');
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
          Visual: {
            path: '/Components/Visual',
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

test('build does not fetch html/css for MultiRoute and Route', async () => {
  const originalSlice = globalThis.slice;

  try {
    const sliceInstance = createSlice();
    globalThis.slice = sliceInstance;

    class MultiRouteComponent {
      constructor(props) {
        this.props = props;
        this.sliceId = 'MultiRoute';
      }
      async init() {}
    }

    class RouteComponent {
      constructor(props) {
        this.props = props;
        this.sliceId = 'Route';
      }
      async init() {}
    }

    sliceInstance.controller.classes.set('MultiRoute', MultiRouteComponent);
    sliceInstance.controller.classes.set('Route', RouteComponent);

    const builtMultiRoute = await sliceInstance.build('MultiRoute', {});
    const builtRoute = await sliceInstance.build('Route', {});

    assert.ok(builtMultiRoute, 'Expected MultiRoute instance to be created');
    assert.ok(builtRoute, 'Expected Route instance to be created');
    assert.equal(sliceInstance.controller.fetchCalls, 0);
  } finally {
    globalThis.slice = originalSlice;
  }
});

test('build still fetches html/css for Link', async () => {
  const originalSlice = globalThis.slice;

  try {
    const sliceInstance = createSlice();
    globalThis.slice = sliceInstance;

    class LinkComponent {
      constructor(props) {
        this.props = props;
        this.sliceId = 'Link';
      }
      async init() {}
    }

    sliceInstance.controller.classes.set('Link', LinkComponent);

    const builtLink = await sliceInstance.build('Link', {});

    assert.equal(builtLink, null);
    assert.ok(sliceInstance.controller.fetchCalls > 0, 'Expected Link to trigger resource fetches');
  } finally {
    globalThis.slice = originalSlice;
  }
});
