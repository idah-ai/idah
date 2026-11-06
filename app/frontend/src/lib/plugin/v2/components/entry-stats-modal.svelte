<script lang="ts">
  import { ChartColumnIcon } from "@lucide/svelte";
  import { SvelteMap } from "svelte/reactivity";

  import * as Dialog from "@/components/ui/dialog";
  import KbdTooltipButton from "@/components/app/tooltips/KbdTooltipButton.svelte";

  import type { IIdahDriverV2, IStatEntry, IStatTag } from "@/plugin/v2/types";
  import Badge from "@/components/ui/badge/badge.svelte";
  import { formatDuration } from "@/utils/duration";

  // Props
  interface Props {
    driver: IIdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  let open = $state(false);
  let tab = $state<"annotations" | "time">("annotations");
  let stats = $state<IStatEntry[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  function humanizeKey(parts: string[], unitHeader = ""): string {
    const unit = unitHeader.toLowerCase();
    const trimmed = unit && parts.at(-1)?.toLowerCase() === unit ? parts.slice(0, -1) : parts;
    return trimmed
      .join(" ")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  interface TimeRow {
    label: string;
    value: string;
    tags?: IStatTag[];
  }
  interface TimeStepGroup {
    step: string;
    color: string;
    total: string | undefined;
    authors: TimeRow[];
  }

  // Step accent colors shared with the rest of the UI
  const STEP_COLORS: Record<string, string> = {
    annotate: "#7c3aed",
    review: "#1668dc",
    done: "#15803d",
  };

  // Time section → step totals with one indented row per author underneath
  const timeGroups = $derived.by(() => {
    const byStep = new SvelteMap<string, { total?: string; authors: TimeRow[] }>();
    for (const { key, value, label, tags } of stats) {
      const parts = key.split(".");
      if (parts[0] !== "time" || !parts[1]) continue;
      if (!byStep.has(parts[1])) byStep.set(parts[1], { authors: [] });
      const g = byStep.get(parts[1])!;
      if (parts[2] === "total") {
        g.total = value;
      } else {
        g.authors.push({ label: label ?? humanizeKey(parts.slice(2)), value, tags });
      }
    }
    return [...byStep.entries()].map<TimeStepGroup>(([step, g]) => ({
      step: step.charAt(0).toUpperCase() + step.slice(1),
      color: STEP_COLORS[step] ?? "#1668dc",
      total: g.total,
      authors: g.authors,
    }));
  });

  // Total annotations (from the core "annotation.count" stat)
  const annotationTotal = $derived(Number(stats.find((s) => s.key === "annotation.count")?.value ?? 0));

  // Total tracked time across all steps (combined cache on the entry)
  const timeTotal = $derived(Object.values(driver.timeTracking ?? {}).reduce((a, b) => a + b, 0));

  const grouped = $derived.by(() => {
    const map = new SvelteMap<
      string,
      {
        header: string;
        unitHeader?: string;
        rows: {
          label: string;
          sortKey: string;
          value: string;
          tags?: IStatTag[];
        }[];
      }
    >();

    for (const { key, value, section, sectionHeader, unitHeader, label, tags } of stats) {
      if (section === "time") continue; // rendered via timeGroups
      const rest = key.split(".").slice(1);
      const rowLabel = label ?? humanizeKey(rest, unitHeader ?? "");

      if (!map.has(section)) {
        map.set(section, { header: sectionHeader ?? humanizeKey([section]), unitHeader, rows: [] });
      }
      map.get(section)!.rows.push({ label: rowLabel, sortKey: rest.join("."), value, tags });
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, group]) => ({
        section: group.header,
        unitHeader: group.unitHeader,
        rows: group.rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
      }));
  });

  // Stats are collected from the driver: built-in core stats (annotation/category/
  // shape) plus any plugin-registered providers (e.g. idah-video's video info).
  // The modal stays pure presentation — no modality-specific knowledge here.
  async function fetchStats() {
    loading = true;
    error = null;
    try {
      stats = await driver.stats.collect();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to calculate statistics";
    } finally {
      loading = false;
    }
  }

  function handleOpen(isOpen: boolean) {
    open = isOpen;
    if (isOpen) fetchStats();
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpen}>
  <Dialog.Trigger>
    <KbdTooltipButton
      label="Statistics"
      {driver}
      icon={ChartColumnIcon}
      align="center"
      delayDuration={100}
      variant={open ? "default" : "ghost"}
      size="icon-sm"
    />
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content class="max-w-lg">
      <Dialog.Header>
        <Dialog.Title>Entry Statistics</Dialog.Title>
        <Dialog.Description>Annotation statistics and Media information for the current entry.</Dialog.Description>
      </Dialog.Header>

      <div class="mt-3 flex gap-1">
        <button
          type="button"
          onclick={() => (tab = "annotations")}
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
          class:bg-muted={tab === "annotations"}
          class:text-muted-foreground={tab !== "annotations"}
        >
          Annotations
        </button>
        <button
          type="button"
          onclick={() => (tab = "time")}
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
          class:bg-muted={tab === "time"}
          class:text-muted-foreground={tab !== "time"}
        >
          Time
        </button>
      </div>

      <div class="max-h-[50vh] overflow-y-auto pt-2">
        {#if loading}
          <p class="text-muted-foreground py-6 text-center text-sm">Loading…</p>
        {:else if error}
          <p class="text-destructive py-6 text-center text-sm">{error}</p>
        {:else if stats.length === 0}
          <p class="text-muted-foreground py-6 text-center text-sm">No statistics available yet.</p>
        {:else if tab === "annotations"}
          <!-- Annotations tab -->
          <div class="bg-muted/40 my-4 flex items-baseline justify-between rounded-lg px-3 py-2">
            <span class="text-muted-foreground text-base font-bold">Total annotations</span>
            <span class="text-xl font-bold tabular-nums">{annotationTotal}</span>
          </div>

          {#each grouped as { section, unitHeader, rows } (section)}
            <div class="mb-4">
              {#if unitHeader}
                <div
                  class="text-muted-foreground mb-1 flex justify-between text-xs font-semibold tracking-wide uppercase"
                >
                  <span>{section}</span>
                  <span>{unitHeader}</span>
                </div>
              {:else}
                <p class="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">{section}</p>
              {/if}
              <table class="w-full text-sm">
                <tbody>
                  {#each rows as { label, value, tags } (label)}
                    <tr class="border-b last:border-0">
                      <td class="inline-flex items-center gap-2 py-1.5">
                        {label}

                        {#each tags ?? [] as tag (tag.label)}
                          <Badge variant={tag.variant} class="px-1.5 text-[10px]">{tag.label}</Badge>
                        {/each}
                      </td>
                      <td class="py-1.5 text-right tabular-nums">{value}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/each}
        {:else}
          <!-- Time tab -->
          <div class="bg-muted/40 my-4 flex items-baseline justify-between rounded-lg px-3 py-2">
            <span class="text-muted-foreground text-base font-bold">
              Total time ({timeGroups.length}
              {timeGroups.length === 1 ? "step" : "steps"})
            </span>
            <span class="text-xl font-bold tabular-nums">{formatDuration(timeTotal)}</span>
          </div>

          {#if timeGroups.length > 0}
            {#each timeGroups as { step, color, total, authors } (step)}
              <div class="mb-4">
                <div class="mb-1 flex items-baseline justify-between text-xs font-semibold tracking-wide uppercase">
                  <span class="text-muted-foreground inline-flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full" style:background={color}></span>
                    <span>{step}</span>
                  </span>
                  <span class="tabular-nums">{total ?? "—"}</span>
                </div>
                <table class="w-full text-sm">
                  <tbody>
                    {#each authors as author (author.label)}
                      <tr class="border-b last:border-0">
                        <td class="text-muted-foreground py-1.5 pl-5">
                          {author.label}
                          {#each author.tags ?? [] as tag (tag.label)}
                            <Badge variant={tag.variant} class="px-1.5 text-[10px]">{tag.label}</Badge>
                          {/each}
                        </td>
                        <td class="text-muted-foreground py-1.5 text-right tabular-nums">{author.value}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/each}
          {:else}
            <p class="text-muted-foreground py-8 text-center text-sm">No time tracked yet.</p>
          {/if}
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
