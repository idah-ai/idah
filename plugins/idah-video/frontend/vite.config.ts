import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    plugins: [tailwindcss(), isProduction ? svelte() : sveltekit()],
    optimizeDeps: {
      include: ["flubber"],
    },
    resolve: {
      alias: {
        "$lib": new URL("./src/lib", import.meta.url).pathname,
        "$idah": new URL("./src/idah", import.meta.url).pathname,
      },
    },
    build: {
      lib: {
        entry: "src/lib/index.ts",
        name: "idah_plugin",
        external: ["svelte"],
        fileName: (format) => `plugin.${format}.js`,
        cssFileName: "plugin",
      },
      outDir: "build",
      sourcemap: true,
      minify: isProduction ? "esbuild" : false,
      cssMinify: isProduction,
      rollupOptions: {
        output: isProduction ? {} : {
          compact: false,
          indent: "  ",
        },
      },
    },
  };
});
