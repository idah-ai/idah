<script lang="ts">
  import { AspectRatio } from "@/components/ui/aspect-ratio";
  import { Card, CardContent } from "@/components/ui/card";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import DataDisplay from "@/components/app/texts/data-display.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import EntryDropdownMenu from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu.svelte";
  import EntryPriority from "@/components/app/datasets/entries/badges/entry-priority.svelte";
  import EntryStatus from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import ProjectMemberAvatar from "@/components/app/projects/members/avatars/project-member-avatar.svelte";
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
      <Text size="sm" weight="light">
        <a href="/entry/{entry.id}/plugin">{entry.resource}</a>
      </Text>

      <div class="flex flex-col items-start">
        <DataDisplay label="Created at">
          {#snippet slotValue()}
            <DateText datetime={entry.created_at} datetimeFormat="MMM dd, yyyy" size="sm" weight="light" showTooltip
            ></DateText>
          {/snippet}
        </DataDisplay>

        <DataDisplay label="Updated at">
          {#snippet slotValue()}
            <DateText datetime={entry.updated_at} datetimeFormat="MMM dd, yyyy" size="sm" weight="light" showTooltip
            ></DateText>
          {/snippet}
        </DataDisplay>
      </div>

      <!-- PRIORITY AT -->
      <EntryPriority {entry}></EntryPriority>
    </div>

    <!-- STAGE & ASSIGNED TO -->
    <div class="my-auto flex flex-1 flex-col gap-2">
      <DataDisplay label="Stage" value={entry.wf_step}></DataDisplay>
      <DataDisplay label="Assigned to">
        {#snippet slotValue()}
          <ProjectMemberAvatar memberId={entry.assigned_to_id}></ProjectMemberAvatar>
        {/snippet}
      </DataDisplay>
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
