<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props {
    row: DatasetRecord;
  }
  let { row: dataset }: Props = $props();
</script>

<Text>-</Text>
