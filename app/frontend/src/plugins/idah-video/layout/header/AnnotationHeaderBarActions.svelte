<script lang="ts">
  import { InfoIcon, MessageSquareDotIcon, Settings2Icon, SunMoonIcon } from "@lucide/svelte";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { toggleMode } from "mode-watcher";

  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationHeaderBarBaseTool } from "./AnnotationHeaderBar.types";

  // Props
  interface Props {
    context: IActivityContext;
    showCommentsSidebar: boolean;
    onCommentsSidebarToggle: () => void;
  }
  let { context, showCommentsSidebar, onCommentsSidebarToggle }: Props = $props();

  // Variables
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
      label: "Comments",
      icon: MessageSquareDotIcon,
      isActive: showCommentsSidebar,
      handleClick: () => onCommentsSidebarToggle(),
    },
    {
      label: "Help",
      icon: InfoIcon,
      handleClick: () => {},
    },
  ]);
</script>

<div id="annotation-header-bar-actions" class="flex h-full flex-1 items-center justify-end gap-2">
  <div id="annotation-header-bar-actions-menu" class="flex items-center gap-1">
    {#each menus as { label, icon: Icon, isActive, handleClick }, menuIndex (menuIndex)}
      <Tooltips align="center" delayDuration={100}>
        {#snippet trigger()}
          <Button variant={isActive ? "default" : "ghost"} size="icon" onclick={handleClick}>
            <Icon />
          </Button>
        {/snippet}

        {#snippet content()}
          {label}
        {/snippet}
      </Tooltips>
    {/each}
  </div>

  <Button variant="outline" class="border-primary text-primary hover:text-primary">Skip</Button>

  <Button onclick={context.submit}>Submit</Button>
</div>
