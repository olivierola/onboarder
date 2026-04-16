/**
 * Builds ESM + CJS bundles for npm usage.
 * Four entry points → four pairs of output files:
 *   dist/onboarder.esm.js  + dist/onboarder.cjs.js  (core / Vanilla JS / Angular)
 *   dist/react.esm.js      + dist/react.cjs.js       (React wrapper)
 *   dist/vue.esm.js        + dist/vue.cjs.js          (Vue 3 wrapper)
 *   dist/angular.esm.js    + dist/angular.cjs.js      (Angular adapter)
 */

import { defineConfig } from "vite";
import { resolve }      from "path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        "onboarder": resolve(__dirname, "src/core.ts"),
        "react"    : resolve(__dirname, "src/react.tsx"),
        "vue"      : resolve(__dirname, "src/vue.ts"),
        "angular"  : resolve(__dirname, "src/angular.ts"),
        "widget"   : resolve(__dirname, "src/widget.tsx"),
      },
      formats  : ["es", "cjs"],
      fileName : (format, entryName) =>
        `${entryName}.${format === "es" ? "esm" : "cjs"}.js`,
    },
    outDir : "dist",
    emptyOutDir: true,
    rollupOptions: {
      // Framework deps are peer — never bundled
      external: ["react", "react-dom", "react/jsx-runtime", "vue", "@angular/core"],
      output  : {
        globals: {
          react         : "React",
          "react-dom"   : "ReactDOM",
          vue           : "Vue",
          "@angular/core": "ng.core",
        },
      },
    },
  },
});
