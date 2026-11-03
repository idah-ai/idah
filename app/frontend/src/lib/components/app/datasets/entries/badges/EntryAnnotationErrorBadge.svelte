<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";

  import { pluralizeUnit } from "@/utils/unit";
  interface Props {
    count: number;
  }
  let { count }: Props = $props();
</script>

{#if count > 0}
  <Badge variant="destructive-outline" rounded="full">
    <TriangleAlertIcon />
    {count}
    {pluralizeUnit(count, "annotation error")}
  </Badge>
{/if}
