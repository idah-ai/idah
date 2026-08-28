import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  // The `development` mode drives the `vite dev` server (SvelteKit, code-split).
  // Any other mode produces the plugin library build (svelte, UMD/ES output).
  const isLibBuild = mode !== "development";
  // Only the real production build is minified/compacted. The `unminified`
  // mode yields the same library output but readable, for tracing prod errors.
  const minified = mode === "production";

  return {
    plugins: [tailwindcss(), isLibBuild ? svelte() : sveltekit()],
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
      minify: minified ? "esbuild" : false,
      cssMinify: minified,
      rollupOptions: {
        output: minified ? {} : {
          compact: false,
          indent: "  ",
        },
      },
    },
  };
});
