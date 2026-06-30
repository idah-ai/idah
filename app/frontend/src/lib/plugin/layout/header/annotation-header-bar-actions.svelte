<script lang="ts">
  import {
    ChevronDownIcon,
    KeyboardIcon,
    MoonIcon,
    Settings2Icon,
    SquareCheckIcon,
    SquareXIcon,
    SunIcon,
    SunMoonIcon,
    TabletSmartphoneIcon,
  } from "@lucide/svelte";
  import { mode, resetMode, setMode } from "mode-watcher";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ToolTooltip from "@/components/app/tooltips/tool-tooltip.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Checkbox } from "@/components/ui/checkbox";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { getShortcutLabel } from "@/components/ui/kbd/utils";
  import WorkflowStepActions from "@/plugin/layout/header/workflow-step-actions.svelte";
  import type { WorkflowStepConfig } from "@/plugin/layout/header/workflow-step-types";

  import EntryStatsModal from "@/plugin/v2/components/entry-stats-modal.svelte";

  import writableWithLocal from "@/utils/writableWithLocal";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IIdahDriverV2 } from "@/plugin/v2/types";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { refetches } from "@/utils/refetch";

  import type { EntryWorkflowStep } from "@/data/model/dataset/entries/constants";
  import Text from "@/components/ui/text/Text.svelte";

  // Props
  interface Props {
    driver: IIdahDriverV2;
    noteSidebarOpen?: boolean;
    onNoteToggle?: () => void;
  }
  let { driver, noteSidebarOpen = false, onNoteToggle }: Props = $props();

  // Workflow configuration from API response
  interface WorkflowConfig {
    name: string;
    label: string;
    description?: string;
    plugin: string;
    steps?: WorkflowStepConfig[];
  }

  // Variables
  let loading = $state(false);
  let openSettingsPopover = $state(false);
  let currentStepConfig: WorkflowStepConfig | undefined = $state(undefined);

  // Persist auto-select preference in localStorage
  let autoSelectNextEntryStore = writableWithLocal("auto-select-next-entry", false);
  let autoSelectNextEntry = $state($autoSelectNextEntryStore);
  $effect(() => {
    autoSelectNextEntryStore.set(autoSelectNextEntry);
  });

  let showAutoSelect = $derived(
    driver.entryStatus && driver.entryStatus !== "completed" && driver.entryStatus !== "errored",
  );

  // Switch to review mode when entry is completed (only evaluated at mount since entryStatus is static)
  if (driver.entryStatus === "completed") {
    driver.setMode("review");
  }

  // Unresolved note feed count
  let unresolvedFeedCount = $state(0);

  $effect(() => {
    // React to refetches so count updates whenever feeds are fetched/resolved/created
    const _ = $refetches.noteFeeds.list;

    noteFeedsBackendDataSource
      .list({
        filters: {
          entry_id: driver.id,
          status__in: ["pending"],
        },
        fields: { [NoteFeedRecord.type]: ["id"] },
        pagination: { page: 1, itemsPerPage: 1 },
        count: true,
        noCache: true,
      })
      .then((res) => {
        unresolvedFeedCount = res.meta?.count ?? 0;
      })
      .catch(() => {
        unresolvedFeedCount = 0;
      });
  });

  // Track mode changes reactively
  let currentMode = $state(driver.mode);
  driver.onModeChange((event) => {
    currentMode = event.newValue;
  });

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

  import { onMount } from "svelte";
  import { workflowsBasePath } from "@/data/model/dataset/workflows/record";

  // Lifecycle
  onMount(async () => {
    /** If frame step is not set in localStorage, set it to 10 as default */
    if (!localStorage.getItem("idah-video-frame-step")) {
      localStorage.setItem("idah-video-frame-step", "10");
    }

    // Fetch workflow configuration from backend
    try {
      const workflowsList = await fetch(workflowsBasePath);
      const jsonData = await workflowsList.json();

      const workflows: WorkflowConfig[] = jsonData.data.workflows;

      // Find the workflow configuration for the current dataset
      if (workflows && driver.workflowName) {
        const workflow = workflows.find((w: WorkflowConfig) => w.name === driver.workflowName);
        if (workflow) {
          // Find current step config by matching driver.workflowStep
          currentStepConfig = workflow.steps?.find((s: WorkflowStepConfig) => s.name === driver.workflowStep);
        }
      }
    } catch (error) {
      console.error("Failed to fetch workflow configuration:", error);
    }
  });

  // Functions
  async function submitAnnotation() {
    loading = true;
    await submit();
  }

  async function reviewAnnotation(props: { approved: boolean }) {
    const { approved } = props;
    loading = true;
    await submit({ approved });
  }

  async function submit(opts?: Record<string, boolean>) {
    entriesBackendDataSource.submit(driver.id, opts).then(async () => {
      $refetches.entries.list = new Date();

      // ── Auto-select next entry ──────────────────────────────────────────
      if (autoSelectNextEntry) {
        const nextEntryId = await entriesBackendDataSource.findNextEntry(
          driver.dataset.id,
          driver.workflowStep as EntryWorkflowStep,
        );
        if (nextEntryId) {
          const pluginId = page.params.pluginId as string;
          window.location.href = resolve(`/entries/${nextEntryId}/plugin/${pluginId}`);
          return;
        }
      }

      // ── Fallback: existing behavior ─────────────────────────────────────
      try {
        const entriesRes = await entriesBackendDataSource.list({
          fields: {
            [EntryRecord.type]: ["id"],
          },
          filters: {
            dataset_id: driver.dataset.id,
          },
          noCache: true,
          pagination: {
            page: 1,
            itemsPerPage: 1,
          },
        });
        if (entriesRes.data.length) {
          goto(resolve(`/projects/${driver.project.id}/datasets/${driver.dataset.id}/entries`));
        } else {
          goto(resolve(`/projects/${driver.project.id}/datasets`));
        }
      } catch (error) {
        console.error(error);
        goto(resolve(`/projects/${driver.project.id}/datasets`));
      }
    });
  }

  // Determine the current workflow step type
  const isReviewStep = $derived(driver.workflowStep === "review");
  const isDoneStep = $derived(driver.workflowStep === "done");
  const isAnnotateStep = $derived(driver.workflowStep === "annotate");

  // For custom workflow steps (not standard review/annotate/done)
  const isCustomStep = $derived(!isReviewStep && !isDoneStep && !isAnnotateStep && driver.workflowStep !== "start");

  // Get a human-readable label for the current step
  function getStepLabel(step: string): string {
    return step
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function toggleCommand() {
    driver.command.openPalette();
  }

  function cmdShortcut(name: string): string | undefined {
    const s = driver.command.getShortcut(name);
    return s ? getShortcutLabel(s) : undefined;
  }

</script>

<div id="annotation-header-bar-actions" class="flex h-full items-center justify-end gap-2">
  <div id="annotation-header-bar-actions-menu" class="flex items-center gap-1">
    {#if currentMode === "review" || currentMode === "note"}
      <ToolTooltip
        label="All Notes"
        shortcut={cmdShortcut("core.toggle_note_sidebar")}
        align="center"
        delayDuration={100}
      >
        {#snippet trigger()}
          <Button variant={noteSidebarOpen ? "default" : "ghost"} size="icon-sm" onclick={onNoteToggle}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M11.6666 1.66699V6.66699H16.6666M13.3333 10.8337H6.66665M13.3333 14.167H6.66665M8.33331 7.50033H6.66665M12.0833 1.66699H4.99998C4.55795 1.66699 4.13403 1.84259 3.82147 2.15515C3.50891 2.46771 3.33331 2.89163 3.33331 3.33366V16.667C3.33331 17.109 3.50891 17.5329 3.82147 17.8455C4.13403 18.1581 4.55795 18.3337 4.99998 18.3337H15C15.442 18.3337 15.8659 18.1581 16.1785 17.8455C16.4911 18.1581 16.6666 17.109 16.6666 16.667V6.25033L12.0833 1.66699Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </Button>
        {/snippet}
      </ToolTooltip>
    {/if}

    <ToolTooltip label="Shortcuts" shortcut={cmdShortcut("core.palette")} align="center" delayDuration={100}>
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
      </DropdownMenuContent>
    </DropdownMenu>

    <EntryStatsModal {driver} />
  </div>
  <!-- Editor / Review segmented toggle -->
  <div class="bg-muted flex items-center gap-0.5 rounded-lg border p-0.5">
    {#if driver.entryStatus !== "completed"}
      <Button
        variant={currentMode !== "review" && currentMode !== "note" ? "default" : "ghost"}
        size="sm"
        onclick={() => driver.setMode("editor")}
      >
        Editor
      </Button>
    {/if}
    <div class="relative">
      <Button
        variant={currentMode === "review" || currentMode === "note" ? "default" : "ghost"}
        size="sm"
        onclick={() => driver.setMode("review")}
      >
        Review
      </Button>
      {#if unresolvedFeedCount > 0}
        <span
          class="bg-destructive absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold text-white"
        >
          {unresolvedFeedCount > 99 ? "99+" : unresolvedFeedCount}
        </span>
      {/if}
    </div>
  </div>

  <!-- Auto-select next entry checkbox (hidden when entry is done or errored) -->
  {#if showAutoSelect}
    <ToolTooltip
      label="Automatically opens the next available entry after you submit the current one."
      align="center"
      delayDuration={100}
    >
      {#snippet trigger()}
        <label class="flex cursor-pointer whitespace-nowrap" for="auto-select-next">
          <div class="flex items-center gap-1.5 p-1.5">
            <Checkbox bind:checked={autoSelectNextEntry} id="auto-select-next" />
            <Text size="xs" weight="light">Auto-select next entry</Text>
          </div>
        </label>
      {/snippet}
    </ToolTooltip>
  {/if}

  {#if driver.workflowStep === "done"}
    <!-- TODO: What to show? -->
  {:else if driver.workflowStep === "review"}
    {#if currentStepConfig}
      <!-- Use dynamic workflow step component for review with config -->
      <WorkflowStepActions
        workflowStep={driver.workflowStep}
        {loading}
        stepConfig={currentStepConfig}
        onSubmit={async (opts) => {
          loading = true;
          await submit(opts);
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
        workflowStep={driver.workflowStep}
        {loading}
        stepConfig={currentStepConfig}
        onSubmit={async (opts) => {
          loading = true;
          await submit(opts);
        }}
      />
    {:else}
      <!-- Fallback: simple submit button with step name -->
      <Button
        {loading}
        loadingLabel="Submitting {getStepLabel(driver.workflowStep)}"
        size="sm"
        onclick={submitAnnotation}
      >
        Submit {getStepLabel(driver.workflowStep)}
      </Button>
    {/if}
  {:else}
    <!-- Default annotation step or other standard steps -->
    <Button {loading} loadingLabel="Submitting" size="sm" onclick={submitAnnotation}>Submit</Button>
  {/if}
</div>