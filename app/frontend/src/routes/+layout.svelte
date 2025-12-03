<script lang="ts">
  import favicon from "@/components/app/brand/idah-logo-favicon.svg";
  import { Toaster } from "@/components/ui/sonner";
  import { ModeWatcher } from "mode-watcher";
  import "../app.css";
  // Props
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<main class="bg-background relative flex min-h-screen flex-col">
  <ModeWatcher />
  <Toaster position="top-right" richColors />