<script lang="ts">
  import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import PageBreadcrumb from "@/components/app/page/page-breadcrumb.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";
  import Separator from "@/components/ui/separator/separator.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { useSidebar } from "@/components/ui/sidebar";

  // Variables
  const sidebar = useSidebar();

  let sidebarIsOpen: boolean = $derived(sidebar.open);

  onMount(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey) {
        if (event.key === "\\") {
          sidebar.toggle();
          event.preventDefault();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

<header class="flex h-16 shrink-0 items-center gap-2">
  <div class="flex items-center gap-2">
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger>
          <Button variant="ghost" size="icon-sm" class="-ml-1" onclick={() => sidebar.toggle()}>
            {#if sidebarIsOpen}
              <PanelLeftCloseIcon />
            {:else}
              <PanelLeftOpenIcon />
            {/if}
          </Button>
        </TooltipTrigger>

        <TooltipContent>
          {sidebarIsOpen ? "Collapse Sidebar" : "Expand Sidebar"}

          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>\</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4"></Separator>

    <PageBreadcrumb items={$pageBreadcrumbsStore}></PageBreadcrumb>
  </div>
</header>
