import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    plugins: [tailwindcss(), svelte()],
    resolve: {
      alias: {
        $lib: path.resolve("./src/lib"),
        $assets: path.resolve("./src/assets"),
      },
    },
    build: {
      lib: {
        entry: "src/index.ts",
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
