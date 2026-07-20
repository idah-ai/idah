<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { capitalize } from "@/utils/string";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";

  type Props = {
    driver: IdahDriverV2;
  };

  let { driver }: Props = $props();
</script>

<Badge variant="info">{capitalize(driver.workflowStep)}</Badge>
