<script lang="ts">
  import {
    ChevronDownIcon,
    ChevronsLeft,
    ChevronsRight,
    KeyboardIcon,
    MessageCircleIcon,
    MoonIcon,
    Settings2Icon,
    SquareCheckIcon,
    SquareXIcon,
    SunIcon,
    SunMoonIcon,
    TabletSmartphoneIcon,
  } from "@lucide/svelte";
  import { mode, resetMode, setMode } from "mode-watcher";
  import { onMount } from "svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import ToolTooltip from "@/components/app/tooltips/tool-tooltip.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { getShortcut } from "@/components/ui/kbd/utils";
  import WorkflowStepActions from "@/plugin/layout/header/workflow-step-actions.svelte";

  import NoteSidebar from "@/plugin/layout/sidebar/notes/note-sidebar.svelte";
  import NoteOverlay from "@/plugin/layout/sidebar/notes/overlays/note-overlay.svelte";

  import { IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP } from "@/plugin/layout/header/annotation-header-bar.constants";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationHeaderBarBaseTool } from "@/plugin/layout/header/annotation-header-bar.types";

  // Props
  interface Props {
    context: IActivityContext;
    pluginContainerElement: HTMLElement | null;
  }
  let { context, pluginContainerElement }: Props = $props();

  // Workflow step configuration interface
  interface WorkflowStepAction {
    name: string;
    label: string;
    icon?: string;
  }

  interface WorkflowStepConfig {
    name: string;
    label: string;
    description?: string;
    actions?: WorkflowStepAction[];
  }

  interface WorkflowConfig {
    name: string;
    label: string;
    description?: string;
    plugin: string;
    steps?: WorkflowStepConfig[];
  }

  // Variables
  let frameStep: number = $state(Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) || 10);
  let loading = $state(false);
  let openNoteSidebar = $state(false);
  let openSettingsPopover = $state(false);
  let workflowConfig: WorkflowConfig | null = $state(null);
  let currentStepConfig: WorkflowStepConfig | undefined = $state(undefined);
  let menus: AnnotationHeaderBarBaseTool[] = $derived([
    {
      name: "notes",
      label: "All Notes",
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

  // Lifecycle
  onMount(async () => {
    /** If frame step is not set in localStorage, set it to 10 as default */
    if (!localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) {
      localStorage.setItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP, "10");
    }

    frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP));
    // Fetch workflow configuration from backend
    try {
      const response = await fetch(`${import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins/workflows`);
      const data = await response.json();
      console.log("eeee", data.data.workflows);

      // Find the workflow configuration for the current dataset's workflow
      if (data.data.workflows && context.workflowName) {
        const workflow = data.data.workflows.find((w: WorkflowConfig) => w.name === context.workflowName);
        console.log("Found workflow by name:", workflow);
        if (workflow) {
          workflowConfig = workflow;

          // Find current step config by matching context.workflowStep
          currentStepConfig = workflow.steps?.find((s: WorkflowStepConfig) => s.name === context.workflowStep);
          console.log("Current step config:", currentStepConfig);
        }
      }
    } catch (error) {
      console.error("Failed to fetch workflow configuration:", error);
    }
  });

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

  function setFrameStep(inputValue: number) {
    console.log("fsdklfjsdjfdsjfkl");

    const minStep: number = 1;
    let stepToSet: number = inputValue;

    if (isNaN(inputValue)) stepToSet = minStep;
    if (stepToSet < minStep) stepToSet = minStep;
    frameStep = stepToSet;
    localStorage.setItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP, stepToSet.toString());
  }

  // Determine the current workflow step type
  const isReviewStep = $derived(context.workflowStep === "review");
  const isDoneStep = $derived(context.workflowStep === "done");
  const isAnnotateStep = $derived(context.workflowStep === "annotate");

  // For custom workflow steps (not standard review/annotate/done)
  const isCustomStep = $derived(!isReviewStep && !isDoneStep && !isAnnotateStep && context.workflowStep !== "start");

  // Log changes to isCustomStep reactively
  $effect(() => {
    console.log("isCustomStep", isCustomStep, context.workflowStep);
  });

  // Get a human-readable label for the current step
  function getStepLabel(step: string): string {
    return step
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function toggleCommand() {
    context.commands.run("command_dialog");
  }
</script>

<div id="annotation-header-bar-actions" class="flex h-full items-center justify-end gap-2">
  <div id="annotation-header-bar-actions-menu" class="flex items-center gap-1">
    <ToolTooltip
      label="Shortcuts"
      shortcut={getShortcut(context.shortcutReferences?.["command_dialog"].keyCombinations)}
      align="center"
      delayDuration={100}
    >
      {#snippet trigger()}
        <Button variant="ghost" size="icon-sm" onclick={toggleCommand}>
          <KeyboardIcon />
        </Button>
      {/snippet}
    </ToolTooltip>

    <DropdownMenu bind:open={openSettingsPopover}>
      <DropdownMenuTrigger>
        <ToolTooltip label="Settings" align="center" delayDuration={100}>
          {#snippet trigger()}
            <Button
              variant={openSettingsPopover ? "default" : "ghost"}
              size="icon-sm"
              onclick={() => (openSettingsPopover = true)}
            >
              <Settings2Icon />
            </Button>
          {/snippet}
        </ToolTooltip>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" class="min-w-64">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunMoonIcon />
            Theme
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent>
            <DropdownMenuItem disabled={mode.current === "light"} onclick={() => setMode("light")}>
              <SunIcon />
              Light
            </DropdownMenuItem>

            <DropdownMenuItem disabled={mode.current === "dark"} onclick={() => setMode("dark")}>
              <MoonIcon />
              Dark
            </DropdownMenuItem>

            <DropdownMenuItem onclick={() => resetMode()}>
              <TabletSmartphoneIcon />
              System
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Frame step</DropdownMenuLabel>
        <section class="flex flex-col gap-2 px-2 pb-2">
          <div class="text-muted-foreground text-sm">
            Set the number of frames to move <br />
            when clicking the
            <div class="inline-flex items-center gap-1">
              <Button variant="outline" size="icon-sm" disabled>
                <ChevronsLeft class="size-3" />
              </Button>

              <span>or</span>

              <Button variant="outline" size="icon-sm" disabled>
                <ChevronsRight class="size-3" />
              </Button>
            </div>
            buttons<br />

            in the video player.
          </div>

          <NumberField
            name="settings/frame-step"
            class="w-1/2"
            placeholder="Frame step"
            min={1}
            value={frameStep}
            oninput={(e) => setFrameStep(e.currentTarget.valueAsNumber)}
            onblur={(e) => setFrameStep(e.currentTarget.valueAsNumber)}
          />
        </section>
      </DropdownMenuContent>
    </DropdownMenu>

    {#each menus as { label, icon: Icon, isActive, handleClick }, menuIndex (menuIndex)}
      <ToolTooltip {label} align="center" delayDuration={100}>
        {#snippet trigger()}
          <Button variant={isActive ? "default" : "ghost"} size="icon-sm" onclick={handleClick}>
            <Icon />
          </Button>
        {/snippet}
      </ToolTooltip>
    {/each}
  </div>

  <!-- {#if context.workflowStep === "done"}
    TODO: What to show?
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
  {/if} -->

  {#if isDoneStep}
    <!-- TODO: What to show? -->
  {:else if isReviewStep}
    {#if currentStepConfig}
      <!-- Use dynamic workflow step component for review with config -->
      <WorkflowStepActions
        {context}
        {loading}
        stepConfig={currentStepConfig}
        onSubmit={async (opts) => {
          loading = true;
          await context.submit(opts);
        }}
      />
    {:else}
      <!-- Fallback to default review menus -->
      <DropdownMenus menus={reviewMenus}>
        {#snippet trigger({ props })}
          <Button {...props} size="sm" {loading} loadingLabel="Reviewing">
            Submit Review
            <ChevronDownIcon />
          </Button>
        {/snippet}
      </DropdownMenus>
    {/if}
  {:else if isCustomStep}
    <!-- Custom workflow step - use dynamic component if config available -->
    {#if currentStepConfig}
      <WorkflowStepActions
        {context}
        {loading}
        stepConfig={currentStepConfig}
        onSubmit={async (opts) => {
          loading = true;
          await context.submit(opts);
        }}
      />
    {:else}
      <!-- Fallback: simple submit button with step name -->
      <Button
        {loading}
        loadingLabel="Submitting {getStepLabel(context.workflowStep)}"
        size="sm"
        onclick={submitAnnotation}
      >
        Submit {getStepLabel(context.workflowStep)}
      </Button>
    {/if}
  {:else}
    <!-- Default annotation step or other standard steps -->
    <Button {loading} loadingLabel="Submitting" size="sm" onclick={submitAnnotation}>Submit</Button>
  {/if}
</div>

<NoteSidebar {context} open={openNoteSidebar} onSidebarClose={closeNoteSidebar} />

<NoteOverlay {context} {pluginContainerElement} />
