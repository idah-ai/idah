<script lang="ts">
  import { RotateCwIcon } from "@lucide/svelte";

  import * as Alert from "$lib/components/ui/alert/index";

  interface Props {
    warning: boolean;
  }

  let { warning }: Props = $props();
</script>

<Alert.Root class="bg-muted/50 border-muted-foreground/25">
  <RotateCwIcon class="animate-spin" />

  <div>
    <Alert.Title>Updating annotation statistics</Alert.Title>
    <Alert.Description>
      {#if warning}
        We’re still waiting for the server. We’ll keep trying.
      {:else}
        The dataset’s annotation statistics are being recalculated. This may take a moment.
      {/if}
    </Alert.Description>
  </div>
</Alert.Root>
