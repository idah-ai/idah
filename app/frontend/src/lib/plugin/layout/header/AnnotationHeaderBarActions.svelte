<script lang="ts">
  import {
    ChevronDownIcon,
    InfoIcon,
    MessageCircleIcon,
    Settings2Icon,
    SquareCheckIcon,
    SquareXIcon,
    SunMoonIcon,
  } from "@lucide/svelte";
  import { toggleMode } from "mode-watcher";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import NoteSidebar from "@/plugin/layout/sidebar/notes/note-sidebar.svelte";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationHeaderBarBaseTool } from "@/plugin/layout/header/AnnotationHeaderBar.types";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Variables
  let loading = $state(false);
  let openNoteSidebar = $state(false);
  let menus: AnnotationHeaderBarBaseTool[] = $derived([
    {
      label: "Toggle Theme",
      icon: SunMoonIcon,
      handleClick: toggleMode,
    },
    {
      label: "Settings",
      icon: Settings2Icon,
      handleClick: () => {},
    },
    {
      label: "Notes",
      icon: MessageCircleIcon,
      isActive: openNoteSidebar,
      handleClick: () => {
        openNoteSidebar = !openNoteSidebar;
      },
    },
    {
      label: "Help",
      icon: InfoIcon,
      handleClick: () => {},
    },
  ]);

  const reviewMenus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Approve",
          icon: SquareCheckIcon,
          action: () => reviewAnnotation(true),
        },
        {
          label: "Request changes",
          icon: SquareXIcon,
          action: () => reviewAnnotation(false),
        },
      ],
    },
  };

  // Functions
  async function submitAnnotation() {
    loading = true;
    await context.submit();
    window.location.reload();
  }

  async function reviewAnnotation(approved: boolean) {
    loading = true;
    await context.submit({ approved });
    window.location.reload();
  }
</script>

<div id="annotation-header-bar-actions" class="flex h-full items-center justify-end gap-2">
  <div id="annotation-header-bar-actions-menu" class="flex items-center gap-1">
    {#each menus as { label, icon: Icon, isActive, handleClick }, menuIndex (menuIndex)}
      <Tooltips align="center" delayDuration={100}>
        {#snippet trigger()}
          <Button variant={isActive ? "default" : "ghost"} size="icon-sm" onclick={handleClick}>
            <Icon />
          </Button>
        {/snippet}

        {#snippet content()}
          {label}
        {/snippet}
      </Tooltips>
    {/each}
  </div>

  <Button variant="outline" size="sm" class="border-primary text-primary hover:text-primary">Skip</Button>
  {#if context.workflowStep === "done"}
    <!-- TODO: What to show? -->
  {:else if context.workflowStep === "review"}
    <DropdownMenus menus={reviewMenus}>
      {#snippet trigger({ props })}
        <Button {...props} size="sm" {loading} loadingLabel="Reviewing">
          Submit Review
          <ChevronDownIcon />
        </Button>
      {/snippet}
    </DropdownMenus>
  {:else}
    <Button {loading} loadingLabel="Submitting" size="sm" onclick={submitAnnotation}>Submit</Button>
  {/if}
</div>

<NoteSidebar {context} open={openNoteSidebar} onSidebarClose={() => (openNoteSidebar = false)} />
