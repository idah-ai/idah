<script lang="ts">
  import "../app.css";
  // import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "@/components/ui/sonner";

  // Props
  let { children } = $props();
</script>

<main class="bg-background relative flex min-h-screen flex-col">
  <!-- <ModeWatcher /> -->
  <Toaster position="top-right" />
  {@render children?.()}
</main>
