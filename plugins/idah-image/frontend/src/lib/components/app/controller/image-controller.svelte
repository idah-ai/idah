<script lang="ts">
  import { onMount, setContext } from "svelte";

  import ImageOverlay from "$lib/components/app/overlay/image-overlay.svelte";
  import ImagePropertiesSidebar from "$lib/components/app/sidebar/image-properties-sidebar.svelte";
  import ImageSidebar from "$lib/components/app/sidebar/image-sidebar.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import PopoverContent from "$lib/components/ui/popover/popover-content.svelte";
  import PopoverTrigger from "$lib/components/ui/popover/popover-trigger.svelte";
  import Popover from "$lib/components/ui/popover/popover.svelte";
  import { ResizablePane } from "$lib/components/ui/resizable";
  import ResizableHandle from "$lib/components/ui/resizable/resizable-handle.svelte";
  import ResizablePaneGroup from "$lib/components/ui/resizable/resizable-pane-group.svelte";

  import { entryRoot, setIndexedDBUpdatedAt } from "$lib/plugin/store/idb-store.svelte";
  import { currentMode, selectedAnnotation } from "$lib/plugin/store/store";
  import { DEFAULT_MODE, ENTRY_ROOT, IMAGE_BOUNDING_BOX, IMAGE_NOTE, IMAGE_POLYGON } from "$lib/plugin/types";

  import type { AnnotationValue } from "$lib/context/annotation-context";
  import type { IActivityContext } from "$lib/context/context";
  import type { ImageAnnotationObject, ImageShape } from "$lib/context/image-annotation-context";
  import { annotationsIndexedDB, type AnnotationsIndexedDB } from "$lib/plugin/indexedDB";

  // Props
  interface Props {
    context: IActivityContext;
  }

  let { context }: Props = $props();

  // Contexts
  setContext("context", context);

  onMount(() => {
    console.log(context);
  });

  // Variables
  const editableWorkflowSteps = ["annotate", "review"];
  const notableWorkflowSteps = ["annotate", "review", "done"];
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

  let { id: entryId, workflowStep } = $derived(context);
  let editable = $derived<boolean>(editableWorkflowSteps.includes(workflowStep));
  let notable = $derived<boolean>(notableWorkflowSteps.includes(workflowStep));
  let isNoteMode = $derived($currentMode === IMAGE_NOTE);
  let tools: (
    | { label: string; type: string; iconName: string; handleClick: () => void }
    | { label: string; type: string; iconName: string; disabled: boolean; handleClick: () => void }
  )[] = $state([]);
  let showPopOver = $state(false);
  let annotationsIDB: AnnotationsIndexedDB | undefined = $state();

  let annotationId = $derived<string | undefined>($selectedAnnotation ? $selectedAnnotation.metadata.id : undefined);
  let annotationValue: AnnotationValue = $derived($selectedAnnotation?.value || {});

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
    $effect(() => context.tools.setTool($currentMode));

    annotationsIndexedDB(["idah-image", "entry", entryId].join(":")).then((idb) => {
      annotationsIDB = idb;
      fetchAnnotations(idb).then(() => {
        // quick fix if unsynced data, though we dont have way to send it anyway for now if so
        idb?.getAllIndex("type", ENTRY_ROOT).then((anns) => ($entryRoot = anns[0]));
      });
    }, console.error);

    function fetchAnnotations(db: AnnotationsIndexedDB, page = 1, itemsPerPage = 100): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        context.annotations.list({ entry_id: entryId }, { page, itemsPerPage }).then((res) => {
          let d = res.map((ann) => {
            const annotation: ImageAnnotationObject = {
              shape: {
                ...(ann.dimensions as ImageShape),
                range: [ann.dimensions.start, ann.dimensions.end],
              },
              value: {
                ...ann.annotation,
                category: ann.annotation.category || "null",
              },
              metadata: {
                id: ann.id,
                updatedAt: ann.updated_at || new Date(),
                createdAt: ann.created_at || new Date(),
                metadata: ann.metadata || {},
              },
              hidden: false,
              locked: false,
              synced: true,
            };
            if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;
            return annotation;
          });

          if (d.length) {
            db.upsertAnnotations(d).then(() => {
              setIndexedDBUpdatedAt();
              fetchAnnotations(db, page + 1).then(resolve, reject);
            });
          } else {
            resolve();
          }
        });
      });
    }
  });
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
              <ImageOverlay src={context.mediaUrl} />
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
