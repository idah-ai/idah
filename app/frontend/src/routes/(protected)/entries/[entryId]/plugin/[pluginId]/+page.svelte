<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import IdahPlugin from "@/plugin/IdahPlugin.svelte";

  import { createIdahDriverV2, type IdahDriverV2 } from "@/plugin/v2/driver";

  // Variables
  let entryId: string = page.params.entryId as string;
  let driver: IdahDriverV2 | undefined = $state();

  // Derived: check if the entry's step is locked by an external process
  let isLocked = $derived(
    driver ? driver.externalSteps.includes(driver.workflowStep) : false,
  );
  let lockedStep = $derived(isLocked ? driver!.workflowStep : "");

  // Lifecycle
  onMount(async () => {
    try {
      driver = await createIdahDriverV2(entryId);
    } catch (e) {
      console.error("Failed to load entry:", e);
    }
  });
</script>

{#if isLocked}
  <div class="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
    <div class="rounded-full bg-muted p-4">
      <svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    </div>
    <h2 class="text-lg font-semibold">Entry Locked</h2>
    <p class="max-w-md text-sm text-muted-foreground">
      This entry is currently in the "{lockedStep}" step, which is being processed
      by an external application. It will become available once the external process completes.
    </p>
  </div>
{:else if driver}
  <IdahPlugin {driver} />
{:else}
  <div class="flex h-screen flex-col items-center justify-center gap-2">
    <Spinner size="xl"></Spinner>
    <p class="text-muted-foreground text-sm">Loading context for {entryId}...</p>
  </div>
{/if}
