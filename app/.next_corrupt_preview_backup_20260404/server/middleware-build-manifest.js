self.__BUILD_MANIFEST = {
  "polyfillFiles": [
    "static/chunks/polyfills.js"
  ],
  "devFiles": [
    "static/chunks/react-refresh.js"
  ],
  "ampDevFiles": [],
  "lowPriorityFiles": [],
  "rootMainFiles": [],
  "pages": {
    "/": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/index.js"
    ],
    "/_app": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_app.js"
    ],
    "/_error": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_error.js"
    ],
    "/discover": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/discover.js"
    ],
    "/me": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/me.js"
    ],
    "/portfolio": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/portfolio.js"
    ],
    "/trending": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/trending.js"
    ],
    "/workspace": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/workspace.js"
    ]
  },
  "ampFirstPages": []
};
self.__BUILD_MANIFEST.lowPriorityFiles = [
"/static/" + process.env.__NEXT_BUILD_ID + "/_buildManifest.js",
,"/static/" + process.env.__NEXT_BUILD_ID + "/_ssgManifest.js",

];