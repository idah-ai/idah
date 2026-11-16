<script lang="ts">
  import MultipleSelectField from "$lib/components/app/forms/fields/select/multiple/multiple-select-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/svelte";
</script>

<section class="flex items-end gap-4">
  <MultipleSelectField
    name="project-dataset-multiple-select"
    label="Datasets"
    class="w-auto max-w-1/2 min-w-80"
    placeholder="Select datasets"
    searchPlaceholder="Search datasets"
    values={[]}
    choices={[]}
  />

  <div class="bg-secondary flex h-9 w-fit items-center gap-2 rounded-lg">
    <Button variant="ghost">All datasets (8)</Button>
    <Separator orientation="vertical" />

    <Button variant="ghost" size="icon">
      <ChevronLeftIcon />
    </Button>

    <Button variant="ghost">Video 1</Button>

    <Button variant="ghost" size="icon">
      <ChevronRightIcon />
    </Button>
  </div>
</section>
