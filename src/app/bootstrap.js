(function attachAppBootstrap(globalScope) {
  "use strict";

  function bootstrap() {
    const storage = globalScope.AppStorage ?? null;
    globalScope.AppState?.setStorage?.(storage);

    return {
      storage,
      screen: globalScope.AppScreen ?? null,
      state: globalScope.AppState ?? null,
    };
  }

  const AppBootstrap = Object.freeze({
    bootstrap,
  });

  globalScope.AppBootstrap = AppBootstrap;

  if (typeof exports !== "undefined") {
    exports.AppBootstrap = AppBootstrap;
    exports.bootstrap = bootstrap;
    exports.default = AppBootstrap;
  }
})(typeof window !== "undefined" ? window : globalThis);
