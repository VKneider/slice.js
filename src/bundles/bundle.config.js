/**
 * Slice.js Bundle Configuration
 * Generated: 2025-12-16T03:59:12.183Z
 * Strategy: hybrid
 */

// Direct bundle configuration (no fetch required)
export const SLICE_BUNDLE_CONFIG = {
  "version": "2.0.0",
  "strategy": "hybrid",
  "generated": "2025-12-16T03:59:12.181Z",
  "stats": {
    "totalComponents": 26,
    "totalRoutes": 4,
    "sharedComponents": 1,
    "sharedPercentage": "0.0",
    "totalSize": 1608951,
    "criticalSize": 961
  },
  "bundles": {
    "critical": {
      "file": "slice-bundle.critical.js",
      "size": 961,
      "components": [
        "Layout"
      ]
    },
    "routes": {
      "home": {
        "path": [
          "/"
        ],
        "file": "slice-bundle.home.js",
        "size": 1522861,
        "components": [
          "HomePage",
          "Navbar",
          "Link",
          "DropDown",
          "Button",
          "Icon",
          "Input",
          "Switch",
          "Checkbox",
          "Details",
          "CodeVisualizer"
        ],
        "dependencies": [
          "critical"
        ]
      },
      "misc": {
        "path": [
          "/404"
        ],
        "file": "slice-bundle.misc.js",
        "size": 5403,
        "components": [
          "NotFound"
        ],
        "dependencies": [
          "critical"
        ]
      },
      "tools": {
        "path": [
          "/Playground"
        ],
        "file": "slice-bundle.tools.js",
        "size": 1513622,
        "components": [
          "Playground",
          "Navbar",
          "Link",
          "DropDown",
          "Button",
          "Icon",
          "Input",
          "Checkbox",
          "Switch",
          "Select",
          "Card",
          "Details"
        ],
        "dependencies": [
          "critical"
        ]
      }
    }
  }
};

// Auto-initialization if slice is available
if (typeof window !== 'undefined' && window.slice && window.slice.controller) {
  window.slice.controller.bundleConfig = SLICE_BUNDLE_CONFIG;

  // Load critical bundle automatically
  if (SLICE_BUNDLE_CONFIG.bundles.critical && !window.slice.controller.criticalBundleLoaded) {
    import('./slice-bundle.critical.js').catch(err =>
      console.warn('Failed to load critical bundle:', err)
    );
    window.slice.controller.criticalBundleLoaded = true;
  }
}
