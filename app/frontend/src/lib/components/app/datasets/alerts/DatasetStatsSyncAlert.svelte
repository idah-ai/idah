<script lang="ts">
  import { RefreshCwIcon, TriangleAlertIcon } from "@lucide/svelte";

  import * as Alert from "$lib/components/ui/alert/index";
  import type { StatsSyncState } from "@/utils/dataset-stats-sync.svelte";

  interface Props {
    state: Exclude<StatsSyncState, "idle">;
    warning: boolean;
  }

  let { state, warning }: Props = $props();
</script>

<Alert.Root class="bg-muted/50 border-muted-foreground/25">
  {#if state === "unverified"}
    <TriangleAlertIcon />
  {:else}
    <RefreshCwIcon class="animate-spin" />
  {/if}

  <div>
    <Alert.Title>{state === "unverified" ? "Could not confirm stats sync" : "Syncing label changes"}</Alert.Title>
    <Alert.Description>
      {#if state === "unverified"}
        Entry counts were refreshed, but we couldn’t confirm that stats syncing completed.
      {:else if warning}
        We’re still waiting for the server. We’ll keep trying.
      {:else if state === "waiting"}
        Waiting for annotation statistics to start syncing.
      {:else}
        Checking annotations with the updated label configuration. This may take a moment.
      {/if}
    </Alert.Description>
  </div>
</Alert.Root>
