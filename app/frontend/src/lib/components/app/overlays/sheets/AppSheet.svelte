<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { fly } from "svelte/transition";

  import { Button } from "@/components/ui/button";
  import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

  import { closeSheet, sheetStore } from "./sheet.service.svelte";

  import { cn } from "@/utils";

  // Renders every open sheet (see sheet.service.svelte.ts); mounted once in the root layout.

  // A panel is not a dialog: it sits beside the page and above any open modal, so users can
  // read and act at once. An open modal sets pointer-events: none on <body>; the panel opts
  // back in, and modals treat it as an allowed outside area ([data-app-panel]).
  const panel = $derived(sheetStore.panel);

  // On wide screens the panel pushes the page (and centred modals) aside instead of covering
  // them: --app-panel-width is the room it takes. On narrow screens it overlays.
  const PANEL_WIDTH = "24rem"; // sm:max-w-sm
  const wide = new MediaQuery("min-width: 1024px");
  $effect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-panel-width", panel && wide.current ? PANEL_WIDTH : "0px");
    return () => root.style.removeProperty("--app-panel-width");
  });

  // Modals close themselves on Escape; the panel is closed here (before any modal, see FormModal).
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && panel) closeSheet(panel.id);
  }

  // A modal sheet leaves the panel alone: clicking it or pressing Escape for it doesn't close the sheet.
  function keepForPanel(event: Event): void {
    if (
      event.type === "keydown" ? sheetStore.panelOpen : (event.target as Element | null)?.closest?.("[data-app-panel]")
    )
      event.preventDefault();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#each sheetStore.modals as sheet (sheet.id)}
  {@const Body = sheet.component}
  <Sheet open onOpenChange={(open) => !open && closeSheet(sheet.id)}>
    <SheetContent
      side={sheet.side ?? "right"}
      class={cn("overflow-y-auto", sheet.class)}
      onEscapeKeydown={keepForPanel}
      onInteractOutside={keepForPanel}
    >
      <SheetHeader>
        <SheetTitle>{sheet.title}</SheetTitle>
        {#if sheet.description}
          <SheetDescription>{sheet.description}</SheetDescription>
        {/if}
      </SheetHeader>
      <div class="px-4 pb-4">
        <Body {...sheet.props} />
      </div>
    </SheetContent>
  </Sheet>
{/each}

{#if panel}
  {@const Body = panel.component}
  <aside
    data-app-panel
    aria-label={panel.title}
    class={cn(
      "bg-background pointer-events-auto fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l shadow-lg sm:max-w-sm",
      panel.class,
    )}
    transition:fly={{ x: 384, duration: 200 }}
  >
    <header class="flex items-center gap-2 border-b px-5 py-4">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-base font-semibold">{panel.title}</h2>
        {#if panel.description}
          <p class="text-muted-foreground truncate text-xs">{panel.description}</p>
        {/if}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={`Close ${panel.title}`} onclick={() => closeSheet(panel.id)}>
        <XIcon />
      </Button>
    </header>

    <div class="flex-1 overflow-y-auto px-5 py-4">
      {#key panel.id}
        <Body {...panel.props} />
      {/key}
    </div>
  </aside>
{/if}
