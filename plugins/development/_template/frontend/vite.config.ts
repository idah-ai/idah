import { svelte } from '@sveltejs/vite-plugin-svelte'
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite'
import path from "path";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    plugins: [isProduction ? svelte() : sveltekit()],
    resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
      },
    },
    build: {
      lib: {
        entry: "src/lib/index.ts",
        name: "plugin",
        formats: ["umd"],
        fileName: (format) => `plugin.${format}.js`,
        cssFileName: "plugin"
      },
      outDir: "build",
      sourcemap: true,
      minify: isProduction ? "esbuild" : false,
      cssMinify: isProduction,
      rollupOptions: {
        external: ["svelte"],
        output: {
          inlineDynamicImports: true, // ✅ disables code splitting
          compact: isProduction,
          indent: isProduction ? false : "  ",
        }
      }
    }
  }
})