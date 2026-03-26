// @ts-check
import { defineConfig } from "astro/config";

import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: import.meta.env.SITE_URL || "http://localhost:4231",
  trailingSlash: "always",
  integrations: [svelte({ extensions: [".svelte"] })],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      noExternal: ["@lucide/svelte", "bits-ui"],
      alias: {
        // Provide a dummy module for Pagefind in dev mode
        "/pagefind/pagefind.js": new URL("./src/lib/pagefind-stub.ts", import.meta.url).pathname,
      },
    },
    build: {
      rollupOptions: {
        external: ["/pagefind/pagefind.js"],
      },
    },
  },
});
