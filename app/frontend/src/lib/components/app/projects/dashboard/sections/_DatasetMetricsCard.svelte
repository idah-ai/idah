<script lang="ts">
  import * as Card from "@/components/ui/card/index";
  import DatasetNeedingAttentionMetric from "../metrics/_DatasetNeedingAttentionMetric.svelte";
  import OpenEntriesMetric from "../metrics/_OpenEntriesMetric.svelte";
  import OverallProgressMetric from "../metrics/_OverallProgressMetric.svelte";
  import TotalEntriesMetric from "../metrics/_TotalEntriesMetric.svelte";
</script>

<Card.Root class="p-0">
  <Card.Content class="grid p-0 md:grid-cols-4">
    <TotalEntriesMetric />
    <OverallProgressMetric />
    <OpenEntriesMetric />
    <DatasetNeedingAttentionMetric />
  </Card.Content>
</Card.Root>
