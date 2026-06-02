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

  interface StatSection {
    section: string;
    rows: { label: string; value: string }[];
  }

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

  const statsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/entry_stats`;

  function humanizeKey(parts: string[]): string {
    // Everything after the section prefix, joined, then title-cased word by word
    return parts
      .join(" ")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function sectionTitle(section: string): string {
    return section.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const grouped = $derived.by(() => {
    const map = new SvelteMap<string, { label: string; sortKey: string; value: string }[]>();

    for (const { key, value } of stats) {
      const parts = key.split(".");
      const section = parts[0];
      const rest = parts.slice(1);
      const label = humanizeKey(rest);
      const sortKey = rest.join(".");

      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push({ label, sortKey, value });
    }

    const sections: StatSection[] = [];
    for (const [section, rows] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      sections.push({
        section: sectionTitle(section),
        rows: rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ label, value }) => ({ label, value })),
      });
    }
    return sections;
  });

  async function fetchStats() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${statsBasePath}?filter[entry_id__eq]=${driver.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      stats = (body.data ?? []).map((item: { attributes: { key: string; value: string } }) => ({
        key: item.attributes.key,
        value: item.attributes.value,
      }));
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load statistics";
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
          {#each grouped as { section, rows } (section)}
            <div class="mb-4">
              <p class="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">{section}</p>
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
