<script lang="ts">
  import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "@lucide/svelte";

  import PageBreadcrumb from "@/components/app/page/page-breadcrumb.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { useSidebar } from "@/components/ui/sidebar";

  // Variables
  const sidebar = useSidebar();
  let sidebarIsOpen: boolean = $derived(sidebar.open);
</script>

<header class="flex h-16 shrink-0 items-center gap-2">
  <div class="flex items-center gap-2 px-4">
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" class="-ml-1" onclick={() => sidebar.toggle()}>
            {#if sidebarIsOpen}
              <PanelLeftCloseIcon class="size-4"></PanelLeftCloseIcon>
            {:else}
              <PanelLeftOpenIcon class="size-4"></PanelLeftOpenIcon>
            {/if}
          </Button>
        </TooltipTrigger>

        <TooltipContent>
          {sidebarIsOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4"></Separator>

    <PageBreadcrumb items={$pageBreadcrumbsStore}></PageBreadcrumb>
  </div>
</header>
