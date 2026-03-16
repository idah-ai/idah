<script lang="ts">
  import { onMount, setContext } from "svelte";

  import ImagePropertiesSidebar from "$lib/components/app/sidebar/image-properties-sidebar.svelte";
  import ImageSidebar from "$lib/components/app/sidebar/image-sidebar.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import PopoverContent from "$lib/components/ui/popover/popover-content.svelte";
  import PopoverTrigger from "$lib/components/ui/popover/popover-trigger.svelte";
  import Popover from "$lib/components/ui/popover/popover.svelte";
  import { ResizablePane } from "$lib/components/ui/resizable";
  import ResizableHandle from "$lib/components/ui/resizable/resizable-handle.svelte";
  import ResizablePaneGroup from "$lib/components/ui/resizable/resizable-pane-group.svelte";

  import {
    DEFAULT_MODE,
    IMAGE_BOUNDING_BOX,
    IMAGE_NOTE,
    IMAGE_POLYGON,
  } from "$lib/components/app/controller/image-controller.types";
  import ImageOverlay from "$lib/components/app/overlay/image-overlay.svelte";
  import test from "./test.png";

  import type { IActivityContext } from "$lib/context/context";

  // Props
  interface Props {
    context: IActivityContext;
  }

  let { context }: Props = $props();

  // Contexts
  setContext("context", context);

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
        type: IMAGE_BOUNDING_BOX,
        iconName: "vector-square",
        disabled: !["annotate", "review"].includes(context.workflowStep),
        handleClick: () => context.commands.run("tools.bounding_box"),
      },
      {
        label: "Polygon",
        type: IMAGE_POLYGON,
        iconName: "polygon",
        disabled: !["annotate", "review", "done"].includes(context.workflowStep), // Note: Only allow to create note when workflow steps are "annotate" and "review"
        handleClick: () => context.commands.run("tools.polygon"),
      },
      {
        label: "Notes",
        type: IMAGE_NOTE,
        iconName: "message-circle",
        disabled: !["annotate", "review", "done"].includes(context.workflowStep), // Note: Only allow to create note when workflow steps are "annotate" and "review"
        handleClick: () => context.commands.run("tools.note"),
      },
    ];

    context.tools.setTools(tools);
    $effect(() => context.tools.setTool(mode));
  });

  const annotations = $state([
    {
      id: "1",
      type: "bounding_box",
      value: {
        x: 10,
        y: 10,
        width: 100,
        height: 100,
      },
      metadata: {
        created_at: new Date().toISOString(),
        created_by: "user1",
      },
    },
    {
      id: "2",
      type: "polygon",
      value: {
        points: [
          { x: 150, y: 50 },
          { x: 200, y: 80 },
          { x: 180, y: 150 },
        ],
      },
      metadata: {
        created_at: new Date().toISOString(),
        created_by: "user2",
      },
    },
  ]);
</script>

<div class="relative flex h-full w-full flex-col">
  <!-- POPOVER -->
  <Popover
    open={showPopOver}
    onOpenChange={(open: boolean) => {
      showPopOver = open;
    }}
  >
    <PopoverTrigger />

    <PopoverContent class="min-w-80 p-0">
      <div class="h-auto max-h-86 overflow-y-auto p-2">
        <ImageSidebar />
      </div>

      <div class="flex justify-end gap-2 p-2">
        <Button size="sm" variant="outline" onclick={() => (showPopOver = false)}>Cancel</Button>

        <Button size="sm" onclick={() => (showPopOver = false)}>Confirm</Button>
      </div>
    </PopoverContent>
  </Popover>

  <!-- PLUGIN ROOT -->
  <div id="plugin::idah-image" class="flex min-h-0 w-full flex-1">
    <ResizablePaneGroup direction="vertical">
      <!-- MAIN AREA -->
      <ResizablePane defaultSize={60} minSize={15}>
        <ResizablePaneGroup direction="horizontal">
          <!-- LEFT SIDEBAR -->
          <ResizablePane minSize={14} defaultSize={20} maxSize={20}>
            <ImageSidebar />
          </ResizablePane>

          <ResizableHandle withHandle />

          <!-- IMAGE EDITOR -->
          <ResizablePane defaultSize={60}>
            <section id="image-section" class="flex h-full w-full">
              <ImageOverlay src={test} />
            </section>
          </ResizablePane>

          <ResizableHandle withHandle />

          <!-- RIGHT SIDEBAR -->
          <ResizablePane minSize={16} defaultSize={16} maxSize={20}>
            <ImagePropertiesSidebar />
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <!-- BOTTOM PANEL -->
      <ResizableHandle withHandle />
    </ResizablePaneGroup>
  </div>
</div>
