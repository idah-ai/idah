<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { InfoIcon, MessageCircleWarningIcon, Settings2Icon, SunMoonIcon } from "@lucide/svelte";

  import { toggleMode } from "mode-watcher";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationHeaderBarBaseTool } from "./AnnotationHeaderBar.types";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Variables
  let menus: AnnotationHeaderBarBaseTool[] = [
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
      label: "Notifications",
      icon: MessageCircleWarningIcon,
      handleClick: () => {},
    },
    {
      label: "Help",
      icon: InfoIcon,
      handleClick: () => {},
    },
  ];
</script>

<div id="annotation-header-bar-actions" class="flex h-full flex-1 items-center justify-end gap-2">
  <div id="annotation-header-bar-actions-menu" class="flex items-center gap-1">
    {#each menus as { label, icon: Icon, handleClick } (label)}
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" onclick={handleClick}>
              <Icon class="size-4" />
            </Button>
          </TooltipTrigger>

          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    {/each}
  </div>

  <Button variant="outline" class="border-primary text-primary hover:text-primary">Skip</Button>

  <Button onclick={context.submit}>Submit</Button>
</div>
