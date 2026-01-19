import typographyPlugin from "@tailwindcss/typography";
import defaultTheme from "tailwindcss/defaultTheme";
import plugin from "tailwindcss/plugin";

export default {
  content: ["./src/**/*.{astro,html,js,jsx,json,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        primary: "oklch(var(--primary) / <alpha-value>)",
        secondary: "oklch(var(--secondary) / <alpha-value>)",
        accent: "oklch(var(--accent) / <alpha-value>)",
        default: "oklch(var(--default) / <alpha-value>)",
        muted: "oklch(var(--muted) / <alpha-value>)",
        "muted-foreground": "oklch(var(--muted-foreground) / <alpha-value>)",
        button: "oklch(var(--button) / <alpha-value>)",
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--aw-font-sans, ui-sans-serif)", ...defaultTheme.fontFamily.sans],
        serif: ["var(--aw-font-serif, ui-serif)", ...defaultTheme.fontFamily.serif],
        heading: ["var(--aw-font-heading, ui-sans-serif)", ...defaultTheme.fontFamily.sans],
      },

      animation: {
        fade: "fadeInUp 1s both",
      },

      keyframes: {
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(2rem)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    typographyPlugin,
    plugin(({ addVariant }) => {
      addVariant("intersect", "&:not([no-intersect])");
    }),
  ],
  darkMode: "class",
};
