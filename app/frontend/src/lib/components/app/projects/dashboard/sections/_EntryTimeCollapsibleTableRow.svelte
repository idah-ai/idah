<script lang="ts">
  import * as Table from "@/components/ui/table/index";
  import { getEntryWorkflowGroup } from "../project-dashboard.constants";
  import { entryWorkflowSteps } from "@/data/model/dataset/entries/constants";
  import Badge, { type BadgeVariant } from "@/components/ui/badge/badge.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { formatSeconds } from "@/utils/duration";
  import EntryDatasetCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryDatasetCell.svelte";
  import { type EntryWithTimeData } from "./_OpenEntriesCardV2.table";

  interface Props {
    row: EntryWithTimeData;
    expanded: boolean;
    onToggle: (id: string) => void;
    showDataset: boolean;
  }
  let { row, expanded, onToggle, showDataset }: Props = $props();

  const entry = $derived(row as unknown as EntryWithTimeData);

  const stageLabel = $derived(
    entry.status === "completed"
      ? "Done"
      : (entryWorkflowSteps.find((step) => step.value === entry.wf_step)?.label ?? "—"),
  );

  const assigneeLabel = $derived(entry.assigned_to_id != null ? entry.assigned_to_email || "Unassigned" : "Unassigned");
</script>

<!-- Entry row -->
<Table.Row class="hover:bg-muted/50 cursor-pointer" onclick={() => onToggle(entry.id)}>
  <Table.Cell class="font-medium">
    <span class="chevron text-muted-foreground mr-2 inline-block w-3 transition-transform duration-150"
      ><svg class={expanded ? "rotate-90" : ""} width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
        ><path d="M3 1l5 4-5 4z" /></svg
      ></span
    >
    {entry.name || entry.resource || `Entry ${entry.id}`}
  </Table.Cell>

  {#if showDataset}
    <Table.Cell>
      <EntryDatasetCell row={entry} />
    </Table.Cell>
  {/if}

  <Table.Cell>
    <Badge variant={(getEntryWorkflowGroup(entry)?.badgeColor ?? entry.statusBadge.variant) as BadgeVariant}>
      {getEntryWorkflowGroup(entry)?.label ?? entry.statusBadge.label}
    </Badge>
  </Table.Cell>

  <Table.Cell>
    <Text size="sm">{stageLabel}</Text>
  </Table.Cell>

  <Table.Cell>
    <Text size="sm">{assigneeLabel}</Text>
  </Table.Cell>

  <Table.Cell class="text-foreground text-right font-medium tabular-nums">
    {formatSeconds(entry.totalSeconds)}
  </Table.Cell>
</Table.Row>

<!-- Detail row (collapsible) -->
{#if expanded}
  <Table.Row class="detail-row">
    <Table.Cell class="bg-white p-0" colspan={showDataset ? 6 : 5}>
      <div class="pt-1 pr-2 pb-3 pl-7">
        <div class="bg-muted rounded-lg px-3 py-1">
          {#if entry.steps.length > 0}
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-muted-foreground text-left text-[11px] font-medium">
                  <th class="border-border w-2/5 border-b py-1.5 pr-2">Stage</th>
                  <th class="border-border w-[35%] border-b py-1.5 pr-2">Performed by</th>
                  <th class="border-border w-1/4 border-b py-1.5 text-right">Time spent</th>
                </tr>
              </thead>
              <tbody>
                {#each entry.steps as step, i (i)}
                  {@const multi = step.people && step.people.length > 1}
                  <tr class={multi ? "border-b-0" : "border-border/60 border-b last:border-b-0"}>
                    <td class="py-1.5 pr-2 text-[13px] font-medium">{step.stage}</td>
                    <td class="text-muted-foreground py-1.5 pr-2 text-[13px]">
                      {multi ? `${step.people!.length} users` : step.performedBy}
                    </td>
                    <td class="py-1.5 text-right text-[13px] font-medium tabular-nums">
                      {step.seconds > 0 ? formatSeconds(step.seconds) : "Unsubmitted"}
                    </td>
                  </tr>
                  {#if multi}
                    {@const people = step.people!}
                    {#each people as person, j (person.who)}
                      <tr class={j === people.length - 1 ? "border-border/60 border-b last:border-b-0" : "border-b-0"}>
                        <td></td>
                        <td class="text-muted-foreground py-1 pr-2 text-[12px]">{person.who}</td>
                        <td class="text-muted-foreground py-1 text-right text-[12px] tabular-nums">
                          {person.seconds > 0 ? formatSeconds(person.seconds) : "Unsubmitted"}
                        </td>
                      </tr>
                    {/each}
                  {/if}
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="text-muted-foreground py-2 text-sm">No time tracking data available.</p>
          {/if}
        </div>
      </div>
    </Table.Cell>
  </Table.Row>
{/if}
