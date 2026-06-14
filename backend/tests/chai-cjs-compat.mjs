import { createRequire } from "node:module";
import Module from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const chai = await import(pathToFileURL(require.resolve("chai")).href);
const originalLoad = Module._load;

// Chai 6 is ESM-only, while the backend tests are still transpiled as CommonJS.
Module._load = function load(request, parent, isMain) {
  if (request === "chai") {
    return chai;
  }

  return originalLoad.apply(this, arguments);
};
