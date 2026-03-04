import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import path from "path";


/** @type {import('@sveltejs/vite-plugin-svelte').Options} */
const config = {
  preprocess: vitePreprocess(),
  resolve: {
  alias: {
    "$lib": path.resolve(__dirname, "src/lib"),
  }
},
};

export default config;
