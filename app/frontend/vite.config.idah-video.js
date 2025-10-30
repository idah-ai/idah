import alias from "@rollup/plugin-alias";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  build: {
    lib: {
      entry: "src/plugins/idah-video/index.ts",
      // use for now to plug in window.idah_plugin = IActivityView
      name: "idah_plugin",
      external: ["svelte"],
      fileName: (format) => `idah-video.${format}.js`,
      cssFileName: "idah-video",
    },
    outDir: "build/plugins",
    rollupOptions: {
      plugins: alias({
        entries: [
          { find: "@/components", replacement: "/src/lib/components" },
          { find: "@/command", replacement: "/src/lib/command" },
          { find: "@/data", replacement: "/src/lib/data" },
          { find: "@/shortcut", replacement: "/src/lib/shortcut" },
          { find: "@/utils", replacement: "/src/lib/utils" },
          { find: "$lib", replacement: "/src/lib" },
          { find: "$app/state", replacement: "/src/app/state" },
        ],
      }),
    },
    sourcemap: true,
    minify: false,
    cssMinify: true,
  },
});
