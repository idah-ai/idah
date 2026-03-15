<script lang="ts">
import { onMount } from "svelte";

  import IdahImageSidebar from "$lib/components/app/sidebar/idah-image-sidebar.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import PopoverContent from "$lib/components/ui/popover/popover-content.svelte";
  import PopoverTrigger from "$lib/components/ui/popover/popover-trigger.svelte";
  import Popover from "$lib/components/ui/popover/popover.svelte";
  import { ResizablePane } from "$lib/components/ui/resizable";
  import ResizableHandle from "$lib/components/ui/resizable/resizable-handle.svelte";
  import ResizablePaneGroup from "$lib/components/ui/resizable/resizable-pane-group.svelte";
  
  import test from "$assets/test.jpeg";
  import { DEFAULT_MODE, IDAH_IMAGE_BOUNDING_BOX, IDAH_IMAGE_POLYGON, IDAH_NOTE } from "$lib/components/app/controller/idah-image-controller.types";
  import type { IActivityContext } from "../../../../context";
  import IdahImageOverlay from "../overlay/idah-image-overlay.svelte";


    // Props
  interface Props {
    context: IActivityContext;
  }

  let { context }: Props = $props();

  // Variables
  let mode: string = $state("visual");
  let annotationSidebarResizablePercentage = $state<number>(16);

  let tools: (
    | { label: string; type: string; iconName: string; handleClick: () => void }
    | { label: string; type: string; iconName: string; disabled: boolean; handleClick: () => void }
  )[] = $state([]);

  let showPopOver = $state(false);

   onMount(async () => {
    tools = [
      {
        label: "Visual",
        type: DEFAULT_MODE,
        iconName: "mouse-pointer-2",
        handleClick: () => context.commands.run("tools.visual"),
      },
      {
        label: "Bounding Box",
        type: IDAH_IMAGE_BOUNDING_BOX,
        iconName: "vector-square",
        disabled: !["annotate", "review"].includes(context.workflowStep),
        handleClick: () => context.commands.run("tools.bounding_box"),
      },
       {
        label: "Polygon",
        type: IDAH_IMAGE_POLYGON,
        iconName: "polygon",
        disabled: !["annotate", "review", "done"].includes(context.workflowStep), // Note: Only allow to create note when workflow steps are "annotate" and "review"
        handleClick: () => context.commands.run("tools.polygon"),
      },
      {
        label: "Notes",
        type: IDAH_NOTE,
        iconName: "message-circle",
        disabled: !["annotate", "review", "done"].includes(context.workflowStep), // Note: Only allow to create note when workflow steps are "annotate" and "review"
        handleClick: () => context.commands.run("tools.note"),
      },
    ];

    context.tools.setTools(tools);
       $effect(() => context.tools.setTool(mode));

  });
</script>

<div class="relative flex h-full w-full flex-col ">
  <Popover
    open={showPopOver}
    onOpenChange={(open: boolean) => {
      showPopOver = open;
    }}
  >
    <PopoverTrigger></PopoverTrigger>

    <PopoverContent class="min-w-80 p-0">
      <div class="h-auto max-h-86 overflow-y-auto p-2">
      <IdahImageSidebar />
      </div>

      <div class=" flex justify-end gap-2 p-2">
        <Button
          size="sm"
          variant="outline"
          onclick={() => {
            showPopOver = false;
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onclick={() => {
            showPopOver = false;
          }}>
          Confirm
          </Button>
      </div>
    </PopoverContent>
  </Popover>

  <div id="plugin::idah-image" class="flex min-h-0 w-full flex-1">
    <ResizablePaneGroup direction="vertical">
      <ResizablePane defaultSize={60} minSize={15}>
        <ResizablePaneGroup direction="horizontal">
          <ResizablePane minSize={14} defaultSize={annotationSidebarResizablePercentage} maxSize={20}>
           <IdahImageSidebar />
          </ResizablePane>

          <!--
            NOTE: Can not resize annotation sidebar,
            as it will affect the note overlay and svg overlay
            <ResizableHandle withHandle />
          -->

         <ResizablePane defaultSize={75}>
  <section id="video-section" class="flex h-full w-full flex-1">

    <IdahImageOverlay
      src={test}
    />

  </section>
</ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <ResizableHandle withHandle />
    </ResizablePaneGroup>
  </div>
</div>
