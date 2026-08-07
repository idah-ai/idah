import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { fileURLToPath } from "node:url";
import ts from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

const gitignorePath = fileURLToPath(new URL("./.gitignore", import.meta.url));

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "svelte/no-navigation-without-resolve": [
        "error",
        {
          ignoreLinks: true,
        },
      ],
      // <ConfirmModal /> is rendered exactly once, from src/routes/+layout.svelte (see the
      // override below). Everything else asks through the service.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/overlays/modals/confirm-modal.svelte"],
              message:
                "Do not render <ConfirmModal /> yourself — it is mounted once in src/routes/+layout.svelte. Use showConfirmModal() from @/components/app/overlays/modals/confirm-modal.service.svelte instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // The single legitimate mount point, plus the component's own test.
    files: ["src/routes/+layout.svelte", "**/confirm-modal.svelte.test.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
);
