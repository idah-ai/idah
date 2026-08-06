<script lang="ts">
  import {
    ChevronDownIcon,
    CircleHelpIcon,
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
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  import type { IdahDriverV2 } from "@/plugin/v2/driver";
  import type { ISettingGroup, ISliderSetting, IOptionsSetting } from "@/plugin/v2/types";

  // Props
  interface Props {
    // Concrete driver (not the sealed IIdahDriverV2) — same as this component's
    // parent — so core-only adapters like `settingsAdapter` are reachable.
    driver: IdahDriverV2;
    noteSidebarOpen?: boolean;
    onNoteToggle?: () => void;
  }
  let { driver, noteSidebarOpen = false, onNoteToggle }: Props = $props();

  // Variables
  let loading = $state(false);
  let openSettingsPopover = $state(false);
  let openThemeMenu = $state(false);

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

  // Re-read every setting's current value into the mirror. Called on open and
  // again whenever the plugin calls driver.settings.emitChange (which our
  // onChange subscription below observes) — e.g. a value changed via a keyboard
  // shortcut or the command palette while the menu is open.
  function reseedSettingValues(groups: ISettingGroup[]): void {
    const seeded: Record<string, number | string> = {};
    for (const group of groups) {
      for (const item of group.items) {
        seeded[settingKey(group.section, item.key)] = item.get();
      }
    }
    settingValues = seeded;
  }

  $effect(() => {
    if (!openSettingsPopover) return;
    // collect/onChange are core-only, so they live on the concrete adapter
    // rather than the sealed driver.settings handed to plugins.
    const settings = driver.settingsAdapter;
    if (!settings) return;
    const groups = settings.collect();
    settingGroups = groups;
    reseedSettingValues(groups);
    // While open, keep the mirror in sync with changes from any source
    // (shortcut / palette / this UI). Unsubscribes when the menu closes.
    return settings.onChange(() => reseedSettingValues(groups));
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

  // Settings (Popover) and Theme (DropdownMenu) triggers each explicitly close
  // the OTHER one, composed on `onpointerdown` (not `onclick`). This matters:
  // bits-ui's Popover trigger toggles on `onclick`, but its DropdownMenu trigger
  // toggles on `onpointerdown` (its own `onclick` is a no-op for real mouse
  // clicks — it only handles a synthetic VoiceOver click via `e.detail === 0`).
  // Composing on `onclick` alone therefore never ran in time for the DropdownMenu
  // side: pointerdown already flipped its `open` state (and its {#if} branch swap
  // may have detached the very element the pending click was targeting) before
  // our onclick handler could fire. Binding on `onpointerdown` — the earliest
  // possible event, common to both triggers — runs before any of that, and we
  // explicitly forward to `props.onpointerdown` so each trigger's own open
  // behavior still fires correctly (Popover simply has no onpointerdown to
  // forward to, so that call is a harmless no-op there).
  function forwardPointerDown(props: Record<string, unknown>, e: PointerEvent): void {
    (props.onpointerdown as ((e: PointerEvent) => void) | undefined)?.(e);
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
      semantics, so the sliders below drag cleanly.
    -->
    <Popover bind:open={openSettingsPopover}>
      <PopoverTrigger>
        {#snippet child({ props })}
          {#if openSettingsPopover}
            <!-- No tooltip while open, or it peeks out from behind the popover -->
            <Button
              {...props}
              variant="default"
              size="icon-sm"
              onpointerdown={(e) => {
                openThemeMenu = false;
                forwardPointerDown(props, e);
              }}
            >
              <Settings2Icon />
            </Button>
          {:else}
            <ToolTooltip label="Settings" align="center" delayDuration={100}>
              {#snippet trigger()}
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  onpointerdown={(e) => {
                    openThemeMenu = false;
                    forwardPointerDown(props, e);
                  }}
                >
                  <Settings2Icon />
                </Button>
              {/snippet}
            </ToolTooltip>
          {/if}
        {/snippet}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        class="w-64"
        onOpenAutoFocus={(e) => {
          // FocusScope's default behavior focuses the first tabbable element on
          // open — which is the first item's "?" description icon, not the
          // actual control (Slider/options). Suppressing it leaves focus where
          // it naturally is; Tab still works normally for a keyboard user who
          // explicitly navigates in, this only skips the automatic first jump.
          e.preventDefault();
        }}
      >
        <!-- Plugin-contributed settings (e.g. opacity), one section per plugin -->
        {#each settingGroups as group, groupIndex (group.section)}
          <div class={groupIndex === 0 ? "flex flex-col gap-3" : "mt-3 flex flex-col gap-3"}>
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
                    <span class="flex items-center gap-2 text-sm">
                      {item.label}
                      {#if item.description}
                        <!--
                          avoidCollisions={false} forces side="right": the Popover already sits near
                          the screen's right edge, so collision-flip would otherwise reverse this
                          to the left. ignoreNonKeyboardFocus prevents this tooltip from popping
                          open the instant the Settings menu opens — bits-ui's Tooltip opens on ANY
                          focus by default (including the Popover's auto-focus-on-open landing on
                          this trigger since it's the first focusable element), and this restricts
                          opening to genuine keyboard (:focus-visible) navigation.
                        -->
                        <TooltipProvider ignoreNonKeyboardFocus>
                          <Tooltip delayDuration={100} ignoreNonKeyboardFocus>
                            <TooltipTrigger>
                              <CircleHelpIcon class="text-muted-foreground size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8} avoidCollisions={false} class="max-w-56">
                              {item.description}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      {/if}
                    </span>
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
                  <span class="flex items-center gap-2 text-sm">
                    {item.label}
                    {#if item.description}
                      <!--
                        avoidCollisions={false} forces side="right": the Popover already sits near
                        the screen's right edge, so collision-flip would otherwise reverse this
                        to the left. ignoreNonKeyboardFocus prevents this tooltip from popping
                        open the instant the Settings menu opens — bits-ui's Tooltip opens on ANY
                        focus by default (including the Popover's auto-focus-on-open landing on
                        this trigger since it's the first focusable element), and this restricts
                        opening to genuine keyboard (:focus-visible) navigation.
                      -->
                      <TooltipProvider ignoreNonKeyboardFocus>
                        <Tooltip delayDuration={100} ignoreNonKeyboardFocus>
                          <TooltipTrigger>
                            <CircleHelpIcon class="text-muted-foreground size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8} avoidCollisions={false} class="max-w-56">
                            {item.description}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    {/if}
                  </span>
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

    <!-- Theme — standalone dropdown, discrete choices so plain menu hover is safe here -->
    <DropdownMenu bind:open={openThemeMenu}>
      <DropdownMenuTrigger>
        {#snippet child({ props })}
          {#if openThemeMenu}
            <Button
              {...props}
              variant="default"
              size="icon-sm"
              onpointerdown={(e) => {
                openSettingsPopover = false;
                forwardPointerDown(props, e);
              }}
            >
              <SunMoonIcon />
            </Button>
          {:else}
            <ToolTooltip label="Theme" align="center" delayDuration={100}>
              {#snippet trigger()}
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  onpointerdown={(e) => {
                    openSettingsPopover = false;
                    forwardPointerDown(props, e);
                  }}
                >
                  <SunMoonIcon />
                </Button>
              {/snippet}
            </ToolTooltip>
          {/if}
        {/snippet}
      </DropdownMenuTrigger>

      <!-- onCloseAutoFocus prevented: FocusScope otherwise returns focus to the
           trigger when the menu closes, leaving the Theme button visibly focused. -->
      <DropdownMenuContent align="start" side="bottom" onCloseAutoFocus={(e) => e.preventDefault()}>
        <!-- closeOnSelect={false}: picking a theme keeps the menu open so the
             new selection is visible and others can be tried without reopening.
             Selected option gets the same "active" treatment as a selected
             tool/mode elsewhere (bg-primary, matching Button's default variant)
             instead of being disabled/greyed — it stays clickable, same as those.
             Compared against userPrefersMode (the raw stored preference: "light" |
             "dark" | "system"), NOT the resolved `mode` — otherwise picking "System"
             on a dark-OS machine would highlight "Dark" instead of "System". -->
        <DropdownMenuItem
          closeOnSelect={false}
          class={userPrefersMode.current === "light"
            ? "bg-primary text-primary-foreground data-highlighted:bg-primary/90 data-highlighted:text-primary-foreground"
            : ""}
          onclick={() => setMode("light")}
        >
          <SunIcon />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          closeOnSelect={false}
          class={userPrefersMode.current === "dark"
            ? "bg-primary text-primary-foreground data-highlighted:bg-primary/90 data-highlighted:text-primary-foreground"
            : ""}
          onclick={() => setMode("dark")}
        >
          <MoonIcon />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          closeOnSelect={false}
          class={userPrefersMode.current === "system"
            ? "bg-primary text-primary-foreground data-highlighted:bg-primary/90 data-highlighted:text-primary-foreground"
            : ""}
          onclick={() => resetMode()}
        >
          <TabletSmartphoneIcon />
          System
        </DropdownMenuItem>
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
