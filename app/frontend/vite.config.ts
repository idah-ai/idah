import tailwindcss from "@tailwindcss/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import path from "path"

export default defineConfig({
  plugins: [
    {
      name: 'watch-build-folder',
      configureServer(server) {
        const buildPath = path.resolve(__dirname, 'build')

        // Add folder to chokidar watcher
        server.watcher.add(buildPath)

        // Trigger full reload when anything in build changes
        server.watcher.on('change', (file) => {
          if (file.startsWith(buildPath)) {
            console.log('Build file changed:', file)
            server.ws.send({ type: 'full-reload' })
          }
        })
      }
    },
    tailwindcss(),
    sveltekit()
  ],
  server: {
    watch: {
      // use polling if file system events don’t trigger (Docker, WSL, NFS)
      usePolling: true,
      interval: 100
    }
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
