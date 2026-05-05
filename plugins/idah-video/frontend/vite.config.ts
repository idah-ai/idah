import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite'
import path from "path";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    plugins: [tailwindcss(), isProduction ? svelte() : sveltekit()],
    resolve: {
      alias: {
        "$lib": path.resolve("./src/lib"),
        "$idah": path.resolve("./src/idah"),
        "$mock": path.resolve("./src/mock"),
      },
    },
    build: {
      lib: {
        entry: "src/lib/index.ts",
        // use for now to plug in window.idah_plugin = IActivityView
        name: "idah_plugin",
        external: ["svelte"],
        fileName: (format) => `plugin.${format}.js`,
        cssFileName: "plugin",
      },
      outDir: "build",
      sourcemap: true,
      minify: isProduction ? "esbuild" : false,  // Minify in production, readable in dev
      cssMinify: isProduction,  // Minify CSS in production
      rollupOptions: {
        output: isProduction ? {} : {
          // Better formatting for readable output in dev mode
          compact: false,
          indent: "  ",
        },
      },
    },
  };
});
