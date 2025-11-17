<script lang="ts">
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Text from "@/components/ui/text/Text.svelte";

  import { truncate } from "@/utils/string";

  import { fieldTypes, type FieldType } from "@/data/model/dataset/labels";
  import type { IConfigPropertyType } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    label: string;
    selectedFieldType: FieldType | undefined;
    onSetLabel: (params: { label: string }) => void;
    onSetType: (params: { type: IConfigPropertyType }) => void;
  }
  let { label, selectedFieldType, onSetLabel, onSetType }: Props = $props();
</script>

<Popover>
  <Tooltips>
    {#snippet trigger()}
      <PopoverTrigger>
        <Button variant="ghost" size="sm" class="cursor-pointer">
          {#if selectedFieldType}
            {@const SelectedTypeIcon = selectedFieldType.icon}
            <SelectedTypeIcon />

            <Text size="sm" weight="medium">{truncate(label, 20)}</Text>
          {/if}
        </Button>
      </PopoverTrigger>
    {/snippet}

    {#snippet content()}
      Edit "{label}"
    {/snippet}
  </Tooltips>

  <PopoverContent align="center" side="bottom" class="p-0">
    <Command>
      <CommandList>
        <CommandGroup heading="Label">
          <InputField name={label} value={label} onblur={(e) => onSetLabel({ label: e.currentTarget.value })} />
        </CommandGroup>

        <CommandGroup heading="Type">
          {#each fieldTypes as { label, value, icon: Icon } (value)}
            <CommandItem onclick={() => onSetType({ type: value })}>
              <Icon class="size-4" />
              {label}
            </CommandItem>
          {/each}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
