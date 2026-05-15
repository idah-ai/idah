<script lang="ts">
  import { ArrowLeftIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";

  import type { IdahDriverV2 } from "@/plugin/v2/idah-driver";

  type Props = {
    driver: IdahDriverV2;
  };

  let { driver }: Props = $props();
</script>

<Button
  variant="outline"
  size="sm"
  onclick={() => {
    // driver.back
  }}
>
  <ArrowLeftIcon />
  Back
</Button>
