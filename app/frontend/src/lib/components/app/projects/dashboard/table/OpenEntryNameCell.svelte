<script lang="ts">
  import { resolve } from "$app/paths";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record }: { record: EntryRecord } = $props();
</script>

<a class="text-primary text-sm underline-offset-4 hover:underline" href={resolve(`/entries/${record.id}/plugin`)}>
  {record.name || record.resource}
</a>
