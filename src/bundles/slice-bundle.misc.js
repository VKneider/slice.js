/**
 * Slice.js Bundle
 * Type: route
 * Generated: 2025-12-16T03:59:12.173Z
 * Strategy: hybrid
 * Components: 1
 * Total Size: 5.3 KB
 */

export const SLICE_BUNDLE = {
  metadata: {
  "version": "2.0.0",
  "type": "route",
  "route": "misc",
  "generated": "2025-12-16T03:59:12.173Z",
  "totalSize": 5403,
  "componentCount": 1,
  "strategy": "hybrid"
},

  components: {
  "NotFound": {
    "name": "NotFound",
    "category": "Visual",
    "categoryType": "Visual",
    "js": "class NotFound extends HTMLElement {\r\n   constructor(props) {\r\n      super();\r\n      slice.attachTemplate(this);\r\n\r\n      slice.controller.setComponentProps(this, props);\r\n      this.debuggerProps = [];\r\n   }\r\n\r\n   init() {\r\n      //change title of the page\r\n      document.title = '404 - Not Found';\r\n   }\r\n}\r\n\r\ncustomElements.define('slice-notfound', NotFound);\r\n",
    "externalDependencies": {},
    "componentDependencies": [],
    "html": "<div class=\"container\">\r\n    <figure>\r\n        <div class=\"sad-mac\"></div>\r\n        <figcaption>\r\n            <span class=\"sr-text\">Error 404: Not Found</span>\r\n            <span class=\"e\"></span>\r\n            <span class=\"r\"></span>\r\n            <span class=\"r\"></span>\r\n            <span class=\"o\"></span>\r\n            <span class=\"r\"></span>\r\n            <span class=\"_4\"></span>\r\n            <span class=\"_0\"></span>\r\n            <span class=\"_4\"></span>\r\n            <span class=\"n\"></span>\r\n            <span class=\"o\"></span>\r\n            <span class=\"t\"></span>\r\n            <span class=\"f\"></span>\r\n            <span class=\"o\"></span>\r\n            <span class=\"u\"></span>\r\n            <span class=\"n\"></span>\r\n            <span class=\"d\"></span>\r\n        </figcaption>\r\n    </figure>\r\n</div>",
    "css": "* {\r\n\tborder: 0;\r\n\tbox-sizing: border-box;\r\n\tmargin: 0;\r\n\tpadding: 0;\r\n}\r\n#app, body {\r\n\tbackground: var(--primary-color);\r\n\tdisplay: flex;\r\n\theight: 100vh;\r\n}\r\n/* I. Containers */\r\nfigure {\r\n\tfont-size: 6px;\r\n\tmargin: auto;\r\n\tpadding: 4em 0;\r\n\twidth: 64em;\r\n}\r\nfigcaption {\r\n\tcolor: var(--font-color);\r\n\tdisplay: flex;\r\n\talign-content: space-between;\r\n\tflex-wrap: wrap;\r\n\theight: 17em;\r\n}\r\nfigcaption span:before, .sad-mac:before {\r\n\tcontent: \"\";\r\n\tdisplay: block;\r\n\twidth: 1em;\r\n\theight: 1em;\r\n\ttransform: translate(-1em,-1em);\r\n} \r\nfigcaption span {\r\n\tdisplay: inline-block;\r\n\tmargin: 0 2em;\r\n\twidth: 4em;\r\n\theight: 6em;\r\n}\r\n.sr-text {\r\n\toverflow: hidden;\r\n\tposition: absolute;\r\n\twidth: 0;\r\n\theight: 0;\r\n}\r\n/* II. Sprites */\r\n/* 1. Sad Mac */\r\n.sad-mac {\r\n\tbackground: #fff;\r\n\tmargin: 0 auto 7em auto;\r\n\twidth: 23em;\r\n\theight: 30em;\r\n}\r\n.sad-mac:before {\r\n\tbox-shadow: 1em 1em, 23em 1em, 4em 3em, 5em 3em, 6em 3em, 7em 3em, 8em 3em, 9em 3em, 10em 3em, 11em 3em, 12em 3em, 13em 3em, 14em 3em, 15em 3em, 16em 3em, 17em 3em, 18em 3em, 19em 3em, 20em 3em, 3em 4em, 21em 4em, 3em 5em, 21em 5em, 3em 6em, 7em 6em, 9em 6em, 15em 6em, 17em 6em, 21em 6em, 3em 7em, 8em 7em, 16em 7em, 21em 7em, 3em 8em, 7em 8em, 9em 8em, 15em 8em, 17em 8em, 21em 8em, 3em 9em, 21em 9em, 3em 10em, 10em 10em, 13em 10em, 21em 10em, 3em 11em, 11em 11em, 12em 11em, 21em 11em, 3em 12em, 21em 12em, 3em 13em, 10em 13em, 11em 13em, 12em 13em, 13em 13em, 14em 13em, 21em 13em, 3em 14em, 9em 14em, 15em 14em, 16em 14em, 21em 14em, 3em 15em, 17em 15em, 21em 15em, 3em 16em, 21em 16em, 4em 17em, 5em 17em, 6em 17em, 7em 17em, 8em 17em, 9em 17em, 10em 17em, 11em 17em, 12em 17em, 13em 17em, 14em 17em, 15em 17em, 16em 17em, 17em 17em, 18em 17em, 19em 17em, 20em 17em, 3em 22em, 4em 22em, 5em 22em, 14em 22em, 15em 22em, 16em 22em, 17em 22em, 18em 22em, 19em 22em, 20em 22em, 1em 27em, 2em 27em, 3em 27em, 4em 27em, 5em 27em, 6em 27em, 7em 27em, 8em 27em, 9em 27em, 10em 27em, 11em 27em, 12em 27em, 13em 27em, 14em 27em, 15em 27em, 16em 27em, 17em 27em, 18em 27em, 19em 27em, 20em 27em, 21em 27em, 22em 27em, 23em 27em, 1em 28em, 23em 28em, 1em 29em, 23em 29em, 1em 30em, 23em 30em;\r\n}\r\n/* 2. Letters */\r\n._0:before {\r\n\tbox-shadow: 2em 1em, 3em 1em, 1em 2em, 1em 3em, 1em 4em, 1em 5em, 4em 2em, 4em 3em, 4em 4em, 4em 5em, 2em 4em, 3em 3em, 2em 6em, 3em 6em;\r\n}\r\n._4:before {\r\n\tbox-shadow: 1em 1em, 1em 2em, 1em 3em, 1em 4em, 4em 1em, 4em 2em, 4em 3em, 4em 4em, 2em 4em, 3em 4em, 4em 5em, 4em 6em;\r\n}\r\n.d:before {\r\n\tbox-shadow: 1em 1em, 2em 1em, 3em 1em, 1em 2em, 4em 2em, 1em 3em, 4em 3em, 1em 4em, 4em 4em, 1em 5em, 4em 5em, 1em 6em, 2em 6em, 3em 6em;\r\n}\r\n.e:before {\r\n\tbox-shadow: 1em 1em, 2em 1em, 3em 1em, 4em 1em, 1em 2em, 1em 3em, 2em 3em, 3em 3em, 1em 4em, 1em 5em, 1em 6em, 2em 6em, 3em 6em, 4em 6em;\r\n}\r\n.f:before {\r\n\tbox-shadow: 1em 1em, 2em 1em, 3em 1em, 4em 1em, 1em 2em, 1em 3em, 2em 3em, 3em 3em, 1em 4em, 1em 5em, 1em 6em;\r\n}\r\n.n:before {\r\n\tbox-shadow: 1em 1em, 1em 2em, 1em 3em, 1em 4em, 1em 5em, 1em 6em, 4em 1em, 4em 2em, 4em 3em, 4em 4em, 4em 5em, 4em 6em, 2em 3em, 3em 4em;\r\n}\r\n.o:before {\r\n\tbox-shadow: 2em 1em, 3em 1em, 1em 2em, 1em 3em, 1em 4em, 1em 5em, 4em 2em, 4em 3em, 4em 4em, 4em 5em, 2em 6em, 3em 6em;\r\n}\r\n.r:before {\r\n\tbox-shadow: 1em 1em, 2em 1em, 3em 1em, 4em 2em, 1em 2em, 1em 3em, 1em 4em, 2em 3em, 3em 3em, 1em 5em, 1em 6em, 4em 4em, 4em 5em, 4em 6em;\r\n}\r\n.t:before {\r\n\tbox-shadow: 1em 1em, 2em 1em, 3em 1em, 2em 2em, 2em 3em, 2em 4em, 2em 5em, 2em 6em;\r\n}\r\n.u:before {\r\n\tbox-shadow: 1em 1em, 1em 2em, 1em 3em, 1em 4em, 1em 5em, 4em 1em, 4em 2em, 4em 3em, 4em 4em, 4em 5em, 2em 6em, 3em 6em;\r\n}\r\n/* III. Responsiveness */\r\n/* This cannot be smoothly done using viewport units; sprite pixels will look divided when font size is a floating point. */\r\n@media screen and (min-width: 720px) {\r\n\tfigure {\r\n\t    font-size: 7px;\r\n\t}\r\n}\r\n@media screen and (min-width: 1440px) {\r\n\tfigure {\r\n\t    font-size: 8px;\r\n\t}\r\n}\r\nhtml, body {\r\n    height: 100%;\r\n    margin: 0;\r\n    display: flex;\r\n    align-items: center;\r\n    justify-content: center;\r\n  }\r\n  \r\n  .container {\r\n    display: flex;\r\n    align-items: center;\r\n    justify-content: center;\r\n    height: 100%;\r\n    width: 100%;\r\n  }\r\n  \r\n  figure {\r\n    text-align: center;\r\n  }",
    "size": 5403
  }
}
};

// Auto-registration of components
if (window.slice && window.slice.controller) {
  slice.controller.registerBundle(SLICE_BUNDLE);
}
