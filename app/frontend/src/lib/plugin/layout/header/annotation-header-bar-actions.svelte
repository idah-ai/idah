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
  import NoteOverlay from "@/plugin/layout/sidebar/notes/overlays/note-overlay.svelte";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationHeaderBarBaseTool } from "@/plugin/layout/header/annotation-header-bar.types";

  // Props
  interface Props {
    context: IActivityContext;
    pluginContainerElement: HTMLElement | null;
  }
  let { context, pluginContainerElement }: Props = $props();

  // Variables
  let loading = $state(false);
  let openNoteSidebar = $state(false);
  let menus: AnnotationHeaderBarBaseTool[] = $derived([
    {
      label: "Toggle Theme",
      icon: SunMoonIcon,
      handleClick: toggleMode,
    },
    // {
    //   label: "Settings",
    //   icon: Settings2Icon,
    //   handleClick: () => {},
    // },
    {
      label: "Notes Sidebar",
      icon: MessageCircleIcon,
      isActive: openNoteSidebar,
      handleClick: () => {
        if (!openNoteSidebar) {
          openNoteSidebar = true;
        } else {
          closeNoteSidebar();
        }
      },
    },
    // {
    //   label: "Help",
    //   icon: InfoIcon,
    //   handleClick: () => {},
    // },
  ]);

  const reviewMenus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Approve",
          icon: SquareCheckIcon,
          action: () => reviewAnnotation({ approved: true }),
        },
        {
          label: "Request changes",
          icon: SquareXIcon,
          action: () => reviewAnnotation({ approved: false }),
        },
      ],
    },
  };

  // Functions
  function closeNoteSidebar() {
    openNoteSidebar = false;

    // Reset selected note feed when closing sidebar
    context.notes.gotoFeed(null);
  }

  async function submitAnnotation() {
    loading = true;
    await context.submit();
  }

  async function reviewAnnotation(props: { approved: boolean }) {
    const { approved } = props;
    loading = true;
    await context.submit({ approved });
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

<NoteSidebar {context} open={openNoteSidebar} onSidebarClose={closeNoteSidebar} />

<NoteOverlay {context} {pluginContainerElement} />
