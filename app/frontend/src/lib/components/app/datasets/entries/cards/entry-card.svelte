<script lang="ts">
  import { AspectRatio } from "@/components/ui/aspect-ratio";
  import { Card, CardContent } from "@/components/ui/card";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import EntryDropdownMenu from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu.svelte";
  import EntryPriority from "@/components/app/datasets/entries/badges/entry-priority.svelte";
  import EntryStatus from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props {
    entry: EntryRecord;
    selectedRows: string[];
    onRowSelect: (selectedId: string) => void;
  }
  let { entry, selectedRows, onRowSelect }: Props = $props();
</script>

<Card>
  <CardContent class="flex flex-row gap-4">
    <!-- CHECKBOX -->
    <div class="my-auto">
      <Checkbox checked={selectedRows.includes(entry.id)} onCheckedChange={() => onRowSelect(entry.id)}></Checkbox>
    </div>

    <!-- THUMBNAIL -->
    <div class="h-full w-[240px]">
      <AspectRatio ratio={16 / 9} class="bg-muted rounded-lg">
        <!-- <img src="" alt="..." class="rounded-lg object-cover" /> -->
      </AspectRatio>
    </div>

    <!-- INFO -->
    <div class="flex flex-1 flex-col gap-6">
      <!-- RESOURCE -->
      <Text size="sm" weight="light">{entry.resource}</Text>

      <div class="flex flex-col items-start">
        <DateText
          datetime={entry.created_at}
          datetimeFormat="'Created at:' MMM dd, yyyy"
          size="sm"
          weight="light"
          showTooltip
        ></DateText>

        <DateText
          datetime={entry.updated_at}
          datetimeFormat="'Updated at:' MMM dd, yyyy"
          size="sm"
          weight="light"
          showTooltip
        ></DateText>
      </div>

      <!-- PRIORITY AT -->
      <EntryPriority {entry}></EntryPriority>
    </div>

    <!-- STAGE & ASSIGNED TO -->
    <div class="my-auto flex flex-1 flex-col gap-2">
      <Text size="sm" weight="light">Stage: {entry.wf_step}</Text>
      <Text size="sm" weight="light">Assigned to: {entry.assigned_to_id || "-"}</Text>
    </div>

    <!-- STATUS & ACTIONS -->
    <div>
      <div class="flex items-center gap-2">
        <EntryStatus {entry}></EntryStatus>
        <EntryDropdownMenu {entry}></EntryDropdownMenu>
      </div>
    </div>
  </CardContent>
</Card>
