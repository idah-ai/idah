<script lang="ts">
  import { CircleAlertIcon, CircleCheckIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from "@lucide/svelte";
  import { ModeWatcher } from "mode-watcher";

  import favicon from "@/components/app/brand/idah-logo-favicon.svg";
  import HelpDrawer from "@/components/app/help/HelpDrawer.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

  import { Toaster } from "@/components/ui/sonner";

  import "../app.css";

  // Props
  let { children } = $props();
</script>

<svelte:head>
  <title>IDAH - Ingedata Annotation Hub</title>
  <link rel="icon" href={favicon} />
</svelte:head>

<!-- the help drawer, when open on a wide screen, takes --help-drawer-width on the right -->
<main
  class="bg-background relative flex min-h-screen flex-col pr-[var(--help-drawer-width,0px)] transition-[padding] duration-200"
>
  <ModeWatcher />

  <Toaster position="bottom-center" richColors>
    {#snippet loadingIcon()}
      <LoaderCircleIcon class="size-4 animate-spin" />
    {/snippet}
    {#snippet successIcon()}
      <CircleCheckIcon class="size-4" />
    {/snippet}
    {#snippet errorIcon()}
      <CircleAlertIcon class="size-4" />
    {/snippet}
    {#snippet infoIcon()}
      <InfoIcon class="size-4" />
    {/snippet}
    {#snippet warningIcon()}
      <TriangleAlertIcon class="size-4" />
    {/snippet}
  </Toaster>

  <ConfirmModal />
  <HelpDrawer />

  {@render children?.()}
</main>
