// @ts-check
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import { defineConfig } from "astro/config";

import svelte from "@astrojs/svelte";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind({
    applyBaseStyles: true,
  }), icon({
    include: {
      tabler: ["*"],
      lucide: ["*"],
      solar: ["*"],
      "flat-color-icons": [
        "template",
        "gallery",
        "approval",
        "document",
        "advertising",
        "currency-exchange",
        "voice-presentation",
        "business-contact",
        "database",
      ],
    },
  }), svelte()],

  vite: {
    plugins: [tailwindcss()],
  },
});