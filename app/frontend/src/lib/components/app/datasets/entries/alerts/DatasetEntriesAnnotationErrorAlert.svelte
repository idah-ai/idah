<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import * as Alert from "$lib/components/ui/alert/index";
  import Button from "@/components/ui/button/button.svelte";

  import { pluralizeUnit } from "@/utils/unit";

  const totalErrorsCount: number = 2;
</script>

<Alert.Root class="bg-destructive/10 border-destructive/50 text-destructive">
  <TriangleAlertIcon />

  <Alert.Description class=" text-destructive inline-flex text-sm">
    <strong>{totalErrorsCount} {pluralizeUnit(totalErrorsCount, "entry", "entries")}</strong>
    <span>have annotation errors.</span>
  </Alert.Description>

  <Alert.Action>
    <Button variant="destructive-outline" size="xs">Show entries</Button>
  </Alert.Action>
</Alert.Root>
