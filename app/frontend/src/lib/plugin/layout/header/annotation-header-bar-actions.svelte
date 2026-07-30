<script lang="ts">
  import {
    ChevronDownIcon,
    KeyboardIcon,
    MoonIcon,
    Settings2Icon,
    SlidersHorizontalIcon,
    SquareCheckIcon,
    SquareXIcon,
    SunIcon,
    SunMoonIcon,
    TabletSmartphoneIcon,
  } from "@lucide/svelte";
  import { resetMode, setMode, userPrefersMode } from "mode-watcher";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ToolTooltip from "@/components/app/tooltips/tool-tooltip.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Checkbox } from "@/components/ui/checkbox";
  import { Slider } from "@/components/ui/slider";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { getShortcutLabel } from "@/components/ui/kbd/utils";

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
  import type { IIdahDriverV2, ISettingGroup, ISliderSetting, IOptionsSetting } from "@/plugin/v2/types";

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

  // Plugin-contributed settings (e.g. opacity sliders). Collected when the
  // Settings menu opens — by then the active plugin has registered via
  // driver.settings.register() during init(). Core just renders the controls;
  // each item's get/set is owned by the plugin.
  //
  // `settingValues` is a core-owned reactive mirror keyed by "section:key". The
  // plugin's value is a $state in the plugin bundle; reading it across the
  // bundle boundary (item.get()) is not tracked by core's render, so the control
  // would go stale on interaction. We seed this mirror on open and drive the UI
  // from it, writing through to item.set() (which the plugin renders live).
  // Values are number (slider) or string (options), so the map holds both.
  let settingGroups = $state<ISettingGroup[]>([]);
  let settingValues = $state<Record<string, number | string>>({});

  function settingKey(section: string, key: string): string {
    return `${section}:${key}`;
  }

  $effect(() => {
    if (!openSettingsPopover) return;
    const groups = driver.settings.collect();
    const seeded: Record<string, number | string> = {};
    for (const group of groups) {
      for (const item of group.items) {
        seeded[settingKey(group.section, item.key)] = item.get();
      }
    }
    settingGroups = groups;
    settingValues = seeded;
  });

  // One writer per control type — keeps `item.set()` type-safe without casts
  // (the union's `set` differs by control). Each mirrors the change locally and
  // writes through to the plugin.
  function setSliderValue(section: string, item: ISliderSetting, value: number): void {
    settingValues[settingKey(section, item.key)] = value;
    item.set(value);
  }

  function setOptionValue(section: string, item: IOptionsSetting, value: string): void {
    settingValues[settingKey(section, item.key)] = value;
    item.set(value);
  }

  // "idah-video" → "Idah Video". The menu appends " Settings".
  function humanizeSection(section: string): string {
    return section.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

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

    <!--
      Settings is a Popover (not a DropdownMenu) on purpose: a menu drives its
      submenus/highlights by pointer hover, which hijacks a slider mid-drag when
      the cursor sweeps over a sibling. A Popover has no hover-to-activate
      semantics, so the sliders below drag cleanly. Theme therefore renders as an
      inline segmented control rather than a hover-expand submenu.
    -->
    <Popover bind:open={openSettingsPopover}>
      <PopoverTrigger>
        {#snippet child({ props })}
          {#if openSettingsPopover}
            <!-- No tooltip while open, or it peeks out from behind the popover -->
            <Button {...props} variant="default" size="icon-sm">
              <Settings2Icon />
            </Button>
          {:else}
            <ToolTooltip label="Settings" align="center" delayDuration={100}>
              {#snippet trigger()}
                <Button {...props} variant="ghost" size="icon-sm">
                  <Settings2Icon />
                </Button>
              {/snippet}
            </ToolTooltip>
          {/if}
        {/snippet}
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" class="w-64">
        <!-- Theme — inline segmented control -->
        <div class="flex flex-col gap-1.5">
          <span class="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <SunMoonIcon class="size-3.5" />
            Theme
          </span>
          <div class="bg-muted grid grid-cols-3 gap-0.5 rounded-lg border p-0.5">
            <Button
              variant={userPrefersMode.current === "light" ? "default" : "ghost"}
              size="sm"
              onclick={() => setMode("light")}
            >
              <SunIcon class="size-3.5" />
              Light
            </Button>
            <Button
              variant={userPrefersMode.current === "dark" ? "default" : "ghost"}
              size="sm"
              onclick={() => setMode("dark")}
            >
              <MoonIcon class="size-3.5" />
              Dark
            </Button>
            <Button
              variant={userPrefersMode.current === "system" ? "default" : "ghost"}
              size="sm"
              onclick={() => resetMode()}
            >
              <TabletSmartphoneIcon class="size-3.5" />
              System
            </Button>
          </div>
        </div>

        <!-- Plugin-contributed settings (e.g. opacity), one section per plugin -->
        {#each settingGroups as group (group.section)}
          <div class="mt-3 flex flex-col gap-2">
            <span class="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              <SlidersHorizontalIcon class="size-3.5" />
              {humanizeSection(group.section)} Settings
            </span>
            {#each group.items as item (item.key)}
              {@const key = settingKey(group.section, item.key)}
              <!--
                Map the plugin-declared control `type` to one of core's own
                components. TO ADD A NEW CONTROL TYPE: after adding its interface
                + union member in types.ts (all three copies), add a branch here
                that narrows on `item.type`, renders the matching core component,
                reads its value from `settingValues[key]`, and writes back via a
                per-type setter (like setSliderValue / setOptionValue).
              -->
              {#if item.type === "slider"}
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm">{item.label}</span>
                    <span class="text-muted-foreground text-xs tabular-nums">{settingValues[key]}</span>
                  </div>
                  <Slider
                    type="single"
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={settingValues[key] as number}
                    onValueChange={(v) => setSliderValue(group.section, item, v)}
                  />
                </div>
              {:else if item.type === "options"}
                <div class="flex flex-col gap-1.5">
                  <span class="text-sm">{item.label}</span>
                  <div
                    class="bg-muted grid gap-0.5 rounded-lg border p-0.5"
                    style="grid-template-columns: repeat({item.options.length}, minmax(0, 1fr));"
                  >
                    {#each item.options as opt (opt.value)}
                      <Button
                        variant={settingValues[key] === opt.value ? "default" : "ghost"}
                        size="sm"
                        onclick={() => setOptionValue(group.section, item, opt.value)}
                      >
                        {opt.label}
                      </Button>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/each}
      </PopoverContent>
    </Popover>

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
