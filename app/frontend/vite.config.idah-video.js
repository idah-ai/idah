import alias from "@rollup/plugin-alias";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    {
      name: "ensure-outdir",
      buildStart() {
        const outDir = path.resolve(__dirname, "build/plugins/idah-video/frontend/build");

        fs.mkdirSync(outDir, { recursive: true });

        console.log("Ensured outDir:", outDir);
      },
    },
    tailwindcss(),
    svelte(),
  ],
  build: {
    lib: {
      entry: "src/plugins/idah-video/index.ts",
      // use for now to plug in window.idah_plugin = IActivityView
      name: "idah_plugin",
      external: ["svelte"],
      fileName: (format) => `idah-video.${format}.js`,
      cssFileName: "idah-video",
    },
    outDir: path.resolve(__dirname, "build/plugins/idah-video/frontend/build"),
    emptyOutDir: true,
    rollupOptions: {
      plugins: alias({
        entries: [
          { find: "@/components", replacement: "/src/lib/components" },
          { find: "@/command", replacement: "/src/lib/command" },
          { find: "@/data", replacement: "/src/lib/data" },
          { find: "@/shortcut", replacement: "/src/lib/shortcut" },
          { find: "@/utils", replacement: "/src/lib/utils" },
          { find: "$lib", replacement: "/src/lib" },
        ],
      }),
    },
    sourcemap: true,
    minify: false,
    cssMinify: true,
  },
});