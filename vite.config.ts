import { defineConfig } from "vite";

/**
 * Builds the module entry point to `scripts/creatureator.js`, matching the
 * `esmodules` path in module.json.
 *
 * Foundry v14 loads modules as native ES modules, so the output format is "es"
 * and nothing is bundled that the browser cannot execute directly. Minification
 * is off: a Foundry module is debugged in the browser console by its users, and
 * readable stack traces are worth more than a few kilobytes.
 */
export default defineConfig({
  build: {
    lib: {
      entry: "src/creatureator.ts",
      formats: ["es"],
      fileName: () => "creatureator.js",
    },
    outDir: "scripts",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      // Foundry provides these as globals; never try to resolve them.
      external: ["foundry"],
    },
  },
});
