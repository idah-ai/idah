import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/vite-plugin-svelte').Options} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    preserveComments: false,
  },
  onwarn: (warning, handler) => {
    if (warning.code.startsWith('a11y')) return;
    handler(warning);
  },
  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      "$idah/*": "./src/idah/*",
      "$mock/*": "./src/mock/*",
      "$lib/*": "./src/lib/*"
    },
  },
};

export default config;
