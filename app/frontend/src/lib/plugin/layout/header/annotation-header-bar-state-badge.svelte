<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";

  type Props = {
    driver: IdahDriverV2;
  };

  let { driver }: Props = $props();

  $effect(() => {
    console.log("driver", driver);
  });
</script>

<Badge variant="info">{driver.workflowStep}</Badge>
