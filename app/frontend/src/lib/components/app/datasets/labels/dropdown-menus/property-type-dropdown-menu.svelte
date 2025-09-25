<script lang="ts">
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { fieldTypes, type FieldType, type FieldTypeValue } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    selectedFieldType: FieldType | undefined;
    onSetType: (params: { type: FieldTypeValue }) => void;
  }
  let { selectedFieldType, onSetType }: Props = $props();
</script>

<DropdownMenu>
  <Tooltips>
    {#snippet trigger()}
      <DropdownMenuTrigger>
        <Button variant="secondary" size="icon" class="cursor-pointer">
          {#if selectedFieldType}
            {@const SelectedTypeIcon = selectedFieldType.icon}
            <SelectedTypeIcon class="size-4"></SelectedTypeIcon>
          {/if}
        </Button>
      </DropdownMenuTrigger>
    {/snippet}

    {#snippet content()}
      Change property type
    {/snippet}
  </Tooltips>

  <DropdownMenuContent>
    <DropdownMenuGroup>
      {#each fieldTypes as { label, value, icon: Icon } (value)}
        <DropdownMenuItem onclick={() => onSetType({ type: value })}>
          <Icon class="size-4"></Icon>
          {label}
        </DropdownMenuItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>
