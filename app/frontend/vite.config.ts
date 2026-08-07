import tailwindcss from "@tailwindcss/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { sentrySvelteKit } from "@sentry/sveltekit";
import { defineConfig } from "vite";

export default defineConfig({
  // Source-map upload needs SENTRY_AUTH_TOKEN in the build environment;
  // enable it once that is wired into CI/Dockerfile.
  plugins: [sentrySvelteKit({ autoUploadSourceMaps: false }), tailwindcss(), sveltekit()],
  server: {
    fs: {
      allow: ["/app/frontend/build"],
    },
    watch: {
      // use polling if file system events don’t trigger (Docker, WSL, NFS)
      usePolling: true,
      interval: 100,
    },
  },
  test: {
    workspace: [
      {
        extends: "./vite.config.ts",
        plugins: [svelteTesting()],
        test: {
          name: "client",
          environment: "jsdom",
          clearMocks: true,
          include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          exclude: ["src/lib/server/**"],
          setupFiles: ["./vitest-setup-client.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.{test,spec}.{js,ts}"],
          exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
        },
      },
    ],
  },
});
