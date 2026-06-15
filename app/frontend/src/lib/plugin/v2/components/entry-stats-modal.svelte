<script lang="ts">
  import { ChartColumnIcon } from "@lucide/svelte";
  import { SvelteMap } from "svelte/reactivity";

  import Button from "@/components/ui/button/button.svelte";
  import * as Dialog from "@/components/ui/dialog";
  import ToolTooltip from "@/components/app/tooltips/tool-tooltip.svelte";

  import type { IIdahDriverV2 } from "@/plugin/v2/types";

  interface EntryStat {
    key: string;
    value: string;
  }

  interface Section {
    header?: string;
    unitHeader?: string;
    labels?: Record<string, string>;
  }

  const SECTIONS: Record<string, Section> = {
    annotation: { header: "Object", unitHeader: "Count", labels: { "annotation.count": "Total" } },
    category: { unitHeader: "Count" },
    shape: { unitHeader: "Count" },
    video: {
      labels: {
        "video.duration_seconds": "Duration in Seconds",
        "video.fps": "Frame(s) per Second",
        "video.frame_count": "Total Number of Frame(s)",
      },
    },
  };

  // Props
  interface Props {
    driver: IIdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  let open = $state(false);
  let stats = $state<EntryStat[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  // INFO(backend-stats): Restore this constant and swap to the backend fetchStats() implementation
  // below to retrieve stats from the backend API instead of calculating locally.
  // const statsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/entry_stats`;

  function humanizeKey(parts: string[], unitHeader = ""): string {
    const unit = unitHeader.toLowerCase();
    const trimmed = unit && parts.at(-1)?.toLowerCase() === unit ? parts.slice(0, -1) : parts;
    return trimmed
      .join(" ")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const grouped = $derived.by(() => {
    const map = new SvelteMap<string, { label: string; sortKey: string; value: string }[]>();

    for (const { key, value } of stats) {
      const parts = key.split(".");
      const sectionKey = parts[0];
      const rest = parts.slice(1);
      const config = SECTIONS[sectionKey];
      const label = config?.labels?.[key] ?? humanizeKey(rest, config?.unitHeader ?? "");
      const sortKey = rest.join(".");

      if (!map.has(sectionKey)) map.set(sectionKey, []);
      map.get(sectionKey)!.push({ label, sortKey, value });
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sectionKey, rows]) => {
        const config = SECTIONS[sectionKey];
        return {
          section: config?.header ?? humanizeKey([sectionKey]),
          unitHeader: config?.unitHeader,
          rows: rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
        };
      });
  });

  // INFO(backend-stats): Backend API implementation of fetchStats().
  // To use: uncomment below, restore statsBasePath above, and comment out the frontend implementation below.
  // async function fetchStats() {
  //   loading = true;
  //   error = null;
  //   try {
  //     const res = await fetch(`${statsBasePath}?filter[entry_id__eq]=${driver.id}`);
  //     if (!res.ok) throw new Error(`HTTP ${res.status}`);
  //     const body = await res.json();
  //     stats = (body.data ?? []).map((item: { attributes: { key: string; value: string } }) => ({
  //       key: item.attributes.key,
  //       value: item.attributes.value,
  //     }));
  //   } catch (e) {
  //     error = e instanceof Error ? e.message : "Failed to load statistics";
  //   } finally {
  //     loading = false;
  //   }
  // }

  // INFO(frontend-stats): Frontend IDB implementation of fetchStats().
  // Calculates stats locally from driver.annotations.fetch(), mirroring backend CoreStats + StatsGenerator.
  // To switch to backend API: comment this out and uncomment the backend implementation above.
  async function fetchStats() {
    loading = true;
    error = null;
    try {
      const staticStats: EntryStat[] = [];
      const meta = driver.media.meta ?? {};
      if (Object.keys(meta).length > 0) {
        const duration = Number(meta.duration ?? 0);
        const fps = Number(meta.fps ?? 0);
        staticStats.push({ key: "video.duration_seconds", value: String(duration) });
        staticStats.push({ key: "video.fps", value: String(fps) });
        staticStats.push({ key: "video.frame_count", value: String(Math.round(duration * fps)) });
      }

      const annotations = await driver.annotations.fetch();
      const rawConfig = driver.config as Record<string, unknown>;

      // Category field can be overridden at the top level of labeling_configuration
      const categoryField = typeof rawConfig.category_field === "string" ? rawConfig.category_field : "category";

      // Zero-fill all configured category ids (mirrors CoreStats)
      const categoryCounts = new SvelteMap<string, number>();
      for (const shapeConfig of Object.values(rawConfig)) {
        if (typeof shapeConfig !== "object" || !shapeConfig || !("values" in shapeConfig)) continue;
        const values = (shapeConfig as { values?: { id?: string }[] }).values ?? [];
        for (const v of values) {
          if (typeof v.id === "string") categoryCounts.set(v.id, 0);
        }
      }

      const shapeCounts = new SvelteMap<string, number>();
      // Zero-fill shape types from config keys — keys containing ":" are modality:tool-type entries
      for (const key of Object.keys(rawConfig)) {
        if (key.includes(":")) shapeCounts.set(key.slice(key.indexOf(":") + 1), 0);
      }

      // Deduplicate by group — pick root annotation (no parent_id) as representative
      const representativeByGroup = new SvelteMap<string, (typeof annotations)[number]>();
      for (const ann of annotations) {
        const meta = ann.metadata as { group_id?: string; parent_id?: string } | undefined;
        const groupKey = meta?.group_id ?? ann.id;
        if (!representativeByGroup.has(groupKey) || !meta?.parent_id) {
          representativeByGroup.set(groupKey, ann);
        }
      }

      for (const ann of representativeByGroup.values()) {
        // Category — read from annotation.value[categoryField]
        const category = (ann.value as Record<string, unknown> | undefined)?.[categoryField];
        if (typeof category === "string") {
          categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
        }

        // Shape type — strip "<modality>:" prefix (mirrors StatsGenerator)
        const rawType = (ann.shape as Record<string, unknown> | undefined)?.type;
        if (typeof rawType === "string") {
          const colonIdx = rawType.indexOf(":");
          const shapeKey = colonIdx >= 0 ? rawType.slice(colonIdx + 1) : rawType;
          shapeCounts.set(shapeKey, (shapeCounts.get(shapeKey) ?? 0) + 1);
        }
      }

      const dynamicResult: EntryStat[] = [];

      dynamicResult.push({ key: "annotation.count", value: String(representativeByGroup.size) });

      for (const [id, count] of categoryCounts) {
        dynamicResult.push({ key: `category.${id}.count`, value: String(count) });
      }

      for (const [shape, count] of shapeCounts) {
        dynamicResult.push({ key: `shape.${shape}.count`, value: String(count) });
      }

      stats = [...dynamicResult, ...staticStats];
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
    <ToolTooltip label="Statistics" align="center" delayDuration={100}>
      {#snippet trigger()}
        <Button variant={open ? "default" : "ghost"} size="icon-sm">
          <ChartColumnIcon />
        </Button>
      {/snippet}
    </ToolTooltip>
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content class="max-w-lg">
      <Dialog.Header>
        <Dialog.Title>Entry Statistics</Dialog.Title>
        <Dialog.Description>Annotation statistics and Media information for the current entry.</Dialog.Description>
      </Dialog.Header>

      <div class="mt-2 max-h-[60vh] overflow-y-auto">
        {#if loading}
          <p class="text-muted-foreground py-6 text-center text-sm">Loading…</p>
        {:else if error}
          <p class="text-destructive py-6 text-center text-sm">{error}</p>
        {:else if stats.length === 0}
          <p class="text-muted-foreground py-6 text-center text-sm">No statistics available yet.</p>
        {:else}
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
                  {#each rows as { label, value } (label)}
                    <tr class="border-b last:border-0">
                      <td class="py-1.5">{label}</td>
                      <td class="py-1.5 text-right tabular-nums">{value}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/each}
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
