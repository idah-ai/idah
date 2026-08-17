<script lang="ts">
  import {
    ChevronDownIcon,
    CircleHelpIcon,
    FileTextIcon,
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
  import KbdTooltipButton from "@/components/app/tooltips/KbdTooltipButton.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
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
  // `collect`/`revision` are core-only, so they live on the concrete adapter
  // rather than the sealed driver.settings handed to plugins. Both deriveds are
  // lazy: nothing evaluates until the markup below reads them, which only
  // happens once the popover is open — so `collect()` still runs after the
  // plugin's init() has registered its providers, never before.
  let settingGroups = $derived(openSettingsPopover ? (driver.settingsAdapter?.collect() ?? []) : []);

  function settingKey(section: string, key: string): string {
    return `${section}:${key}`;
  }

  // Core-owned value mirror keyed by "section:key". The plugin's value is a
  // $state inside the plugin bundle, so reading it across the bundle boundary
  // (item.get()) registers no dependency here and the control would go stale.
  // Reading the adapter's `revision` does register one: any mutation — this UI,
  // a keyboard shortcut, or the command palette — calls emitChange(), which
  // bumps revision and re-runs this, re-reading every value. Same mechanism as
  // `driver.toolbar.revision` in annotation-header-bar-tools.svelte.
  let settingValues = $derived.by(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    driver.settingsAdapter?.revision; // track revision so values re-read on emitChange()
    const values: Record<string, number | string> = {};
    for (const group of settingGroups) {
      for (const item of group.items) {
        values[settingKey(group.section, item.key)] = item.get();
      }
    }
    return values;
  });

  // Single write path for EVERY control type. The caller passes its own already
  // narrowed `item.set(value)` call, so no casts are needed and the union stays
  // type-safe; the notify half is type-agnostic, so a new control type needs a
  // render branch only — no new sync code. `item.set()` is synchronous, so by
  // the time revision bumps, item.get() already returns the new value.
  function commitSetting(write: () => void): void {
    write();
    driver.settingsAdapter?.emitChange();
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
            <KbdTooltipButton
              {...props}
              label="Settings"
              {driver}
              icon={Settings2Icon}
              align="center"
              delayDuration={100}
              variant="ghost"
              size="icon-sm"
              onpointerdown={(e) => {
                openThemeMenu = false;
                forwardPointerDown(props, e);
              }}
            />
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
                + union member in types.ts (core only), add a branch here that
                narrows on `item.type`, renders the matching core component,
                reads its value from `settingValues[key]`, and writes back via
                `commitSetting(() => item.set(v))`. No sync wiring is needed —
                commitSetting and the settingValues mirror are type-agnostic.
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
                    onValueChange={(v) => commitSetting(() => item.set(v))}
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
                        onclick={() => commitSetting(() => item.set(opt.value))}
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
            <KbdTooltipButton
              {...props}
              label="Theme"
              {driver}
              icon={SunMoonIcon}
              align="center"
              delayDuration={100}
              variant="ghost"
              size="icon-sm"
              onpointerdown={(e) => {
                openSettingsPopover = false;
                forwardPointerDown(props, e);
              }}
            />
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
          <SunIcon class="text-current" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          closeOnSelect={false}
          class={userPrefersMode.current === "dark"
            ? "bg-primary text-primary-foreground data-highlighted:bg-primary/90 data-highlighted:text-primary-foreground"
            : ""}
          onclick={() => setMode("dark")}
        >
          <MoonIcon class="text-current" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          closeOnSelect={false}
          class={userPrefersMode.current === "system"
            ? "bg-primary text-primary-foreground data-highlighted:bg-primary/90 data-highlighted:text-primary-foreground"
            : ""}
          onclick={() => resetMode()}
        >
          <TabletSmartphoneIcon class="text-current" />
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
