<script lang="ts">
  import {
    ChevronDownIcon,
    FileTextIcon,
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
  import KbdTooltipButton from "@/components/app/tooltips/KbdTooltipButton.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
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

  import Text from "@/components/ui/text/Text.svelte";
  import EntryStatsModal from "@/plugin/v2/components/entry-stats-modal.svelte";
  import writableWithLocal from "@/utils/writableWithLocal";

  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
  import { refetches } from "@/utils/refetch";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { EntryWorkflowStep } from "@/data/model/dataset/entries/constants";
  import type { IIdahDriverV2 } from "@/plugin/v2/types";

  // Props
  interface Props {
    driver: IIdahDriverV2;
    noteSidebarOpen?: boolean;
    onNoteToggle?: () => void;
  }
  let { driver, noteSidebarOpen = false, onNoteToggle }: Props = $props();

  // Variables
  let loading = $state(false);
  let openSettingsPopover = $state(false);

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

  async function submit(opts?: { approved: boolean }) {
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

  function toggleCommand() {
    driver.command.openPalette();
  }
</script>

<div id="annotation-header-bar-actions" class="flex h-full items-center justify-end gap-2">
  <div id="annotation-header-bar-actions-menu" class="flex items-center gap-1">
    {#if currentMode === "review" || currentMode === "note"}
      <KbdTooltipButton
        label="All Notes"
        {driver}
        commandName="core.toggle_note_sidebar"
        align="center"
        delayDuration={100}
        variant={noteSidebarOpen ? "default" : "ghost"}
        size="icon-sm"
        icon={FileTextIcon}
        onclick={onNoteToggle}
      />
    {/if}

    <KbdTooltipButton
      label="Shortcuts"
      {driver}
      commandName="core.palette"
      icon={KeyboardIcon}
      align="center"
      delayDuration={100}
      variant="ghost"
      size="icon-sm"
      onclick={toggleCommand}
    />

    <DropdownMenu bind:open={openSettingsPopover}>
      <DropdownMenuTrigger>
        <KbdTooltipButton
          label="Settings"
          {driver}
          icon={Settings2Icon}
          align="center"
          delayDuration={100}
          variant={openSettingsPopover ? "default" : "ghost"}
          size="icon-sm"
          onclick={() => (openSettingsPopover = true)}
        />
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
    <Button
      variant={currentMode !== "review" && currentMode !== "note" ? "default" : "ghost"}
      size="sm"
      onclick={() => driver.setMode("editor")}
    >
      Editor
    </Button>
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
    <Tooltips align="center" delayDuration={100}>
      {#snippet trigger()}
        <label class="flex cursor-pointer whitespace-nowrap" for="auto-select-next">
          <div class="flex items-center gap-1.5 p-1.5">
            <Checkbox bind:checked={autoSelectNextEntry} id="auto-select-next" />
            <Text size="xs" weight="light">Auto-select next entry</Text>
          </div>
        </label>
      {/snippet}
      {#snippet content()}
        Automatically opens the next available entry after you submit the current one.
      {/snippet}
    </Tooltips>
  {/if}

  {#if ["done", "error"].includes(driver.workflowStep)}
    <!-- TODO: What to show? -->
  {:else if driver.workflowStep === "review"}
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
