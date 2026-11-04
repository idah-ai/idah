<script lang="ts">
  import { ChevronDownIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Checkbox } from "@/components/ui/checkbox";
  import { Input } from "@/components/ui/input";
  import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { ProjectDashboardDataSources } from "@/data/model/dataset/projects/dashboard/record";

  // Props
  let {
    sources,
    ids,
    select,
  }: { sources: ProjectDashboardDataSources; ids: string[]; select: (ids: string[]) => void } = $props();

  // Variables
  let open = $state(false),
    search = $state(""),
    page = $state(1),
    busy = $state(false),
    more = $state(false),
    error = $state("");
  let options: DatasetRecord[] = $state([]),
    known: { [id: string]: string } = $state({});
  let generation = 0;

  // Functions
  async function load(next = false) {
    const token = ++generation;
    busy = true;
    error = "";
    const nextPage = next ? page + 1 : 1;
    try {
      const response = await sources.datasets.list({
        count: true,
        filters: search ? { name__match: search } : {},
        pagination: { page: nextPage, itemsPerPage: 25 },
      });
      if (token !== generation) return;
      options = next ? [...options, ...response.data] : response.data;
      page = nextPage;
      more = page * 25 < (response.meta?.count ?? 0);
      for (const dataset of response.data) known[dataset.id] = dataset.name;
    } catch {
      if (token === generation) error = "Dataset choices unavailable. Try again.";
    } finally {
      if (token === generation) busy = false;
    }
  }
</script>

<Popover
  {open}
  onOpenChange={(value) => {
    open = value;
    if (value) void load();
  }}
  ><PopoverTrigger
    >{#snippet child({ props })}<Button
        {...props}
        variant="outline"
        class="w-64 max-w-full min-w-0 justify-between"
        title={ids.length === 1 ? known[ids[0]] : undefined}
        ><span class="truncate"
          >{ids.length === 1
            ? (known[ids[0]] ?? "Selected dataset")
            : ids.length
              ? `${ids.length} datasets selected`
              : "All datasets"}</span
        ><ChevronDownIcon class="shrink-0" /></Button
      >{/snippet}</PopoverTrigger
  ><PopoverContent align="start" class="w-96 max-w-[calc(100vw-2rem)] p-2">
    <Input aria-label="Find a dataset" placeholder="Find a dataset…" bind:value={search} oninput={() => void load()} />
    <div class="mt-2 max-h-72 space-y-1 overflow-auto">
      {#each options as dataset (dataset.id)}<div class="hover:bg-accent flex items-center gap-3 rounded-md p-2">
          <Checkbox
            id={"dashboard-select-" + dataset.id}
            checked={ids.includes(dataset.id)}
            onCheckedChange={() =>
              select(ids.includes(dataset.id) ? ids.filter((id) => id !== dataset.id) : [...ids, dataset.id])}
          /><label
            class="min-w-0 flex-1 cursor-pointer text-xs [overflow-wrap:anywhere]"
            for={"dashboard-select-" + dataset.id}>{dataset.name}</label
          ><Button
            size="sm"
            variant="ghost"
            class="shrink-0"
            onclick={() => {
              select([dataset.id]);
              open = false;
            }}>View only</Button
          >
        </div>{/each}
      {#if error}<p class="text-destructive p-2 text-xs">{error}</p>
        <Button size="sm" onclick={() => void load()}>Retry</Button>{:else if more}<Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onclick={() => void load(true)}>Load more</Button
        >{:else if !options.length && !busy}<p class="text-muted-foreground p-2 text-xs">No datasets match.</p>{/if}
      {#if busy}<p class="text-muted-foreground p-2 text-xs">Loading datasets…</p>{/if}
    </div>
    <div class="mt-2 flex justify-between border-t pt-2">
      <Button variant="ghost" size="sm" onclick={() => select([])}>Clear filter</Button><Button
        variant="outline"
        size="sm"
        onclick={() => (open = false)}>Done</Button
      >
    </div>
  </PopoverContent></Popover
>
