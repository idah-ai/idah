<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import AccountEntries from "@/components/app/projects/entries/account-entries.svelte";

  // Props
  interface Props {
    email: string;
    fromRoleLabel: string;
    toRoleLabel: string;
    /** Consequence of this specific (from → to) transition, or null when there is none. */
    warningMessage: string | null;
    /** Whether the transition also needs the member's assigned-entry datasets listed. */
    needsDatasets: boolean;
    accountId: string | number;
    projectId: string;
  }
  let { email, fromRoleLabel, toRoleLabel, warningMessage, needsDatasets, accountId, projectId }: Props = $props();
</script>

<p class="text-muted-foreground text-sm">
  Are you sure you want to change <strong>{email}</strong>'s role from
  <strong>{fromRoleLabel}</strong> to <strong>{toRoleLabel}</strong>?
</p>

{#if warningMessage}
  <div
    class="mt-3 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
  >
    <TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
    <div>
      <span><strong>{email}</strong> {warningMessage}</span>

      {#if needsDatasets}
        <div class="hidden has-[+div:not(:empty)]:block">
          <hr class="my-2 border-amber-300 dark:border-amber-500/40" />
        </div>
        <div class="[&>div]:!text-current">
          <AccountEntries {accountId} {projectId} />
        </div>
      {/if}
    </div>
  </div>
{/if}
