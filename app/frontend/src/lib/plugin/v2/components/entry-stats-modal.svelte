<script lang="ts">
  import { ChartColumnIcon } from "@lucide/svelte";
  import { SvelteMap } from "svelte/reactivity";

  import * as Dialog from "@/components/ui/dialog";
  import KbdTooltipButton from "@/components/app/tooltips/KbdTooltipButton.svelte";

  import type { IIdahDriverV2, IStatEntry } from "@/plugin/v2/types";

  // Props
  interface Props {
    driver: IIdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  let open = $state(false);
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

  const grouped = $derived.by(() => {
    const map = new SvelteMap<
      string,
      { header: string; unitHeader?: string; rows: { label: string; sortKey: string; value: string }[] }
    >();

    for (const { key, value, section, sectionHeader, unitHeader, label } of stats) {
      const rest = key.split(".").slice(1);
      const rowLabel = label ?? humanizeKey(rest, unitHeader ?? "");

      if (!map.has(section)) {
        map.set(section, { header: sectionHeader ?? humanizeKey([section]), unitHeader, rows: [] });
      }
      map.get(section)!.rows.push({ label: rowLabel, sortKey: rest.join("."), value });
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
