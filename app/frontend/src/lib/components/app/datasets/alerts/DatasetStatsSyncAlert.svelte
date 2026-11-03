<script lang="ts">
  import { RefreshCwIcon } from "@lucide/svelte";

  import * as Alert from "$lib/components/ui/alert/index";

  interface Props {
    warning: boolean;
  }

  let { warning }: Props = $props();
</script>

<Alert.Root class="bg-muted/50 border-muted-foreground/25">
  <RefreshCwIcon class="animate-spin" />

  <div>
    <Alert.Title>Syncing label changes</Alert.Title>
    <Alert.Description>
      {#if warning}
        We’re still waiting for the server. We’ll keep trying.
      {:else}
        Checking annotations with the updated label configuration. This may take a moment.
      {/if}
    </Alert.Description>
  </div>
</Alert.Root>
