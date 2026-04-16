/**
 * Builds the IIFE bundle for direct <script> tag usage.
 * Output: dist/onboarder.iife.js  (self-contained, minified)
 */

import { defineConfig } from "vite";
import { resolve }      from "path";

export default defineConfig({
  build: {
    lib: {
      entry   : resolve(__dirname, "src/index.ts"),
      name    : "Onboarder",
      formats : ["iife"],
      fileName: () => "onboarder.iife.js",
    },
    outDir    : "dist",
    emptyOutDir: false,   // Don't wipe ESM/CJS files built first
    minify    : true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
