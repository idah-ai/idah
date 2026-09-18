<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import AccountEntries from "@/components/app/projects/entries/account-entries.svelte";

  // Props
  interface Props {
    accountId: string | number;
    projectId: string;
  }
  let { accountId, projectId }: Props = $props();
</script>

<!-- Stays collapsed until <AccountEntries> actually renders a dataset list. -->
<div
  class="hidden gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400 [&:has(div>div)]:!flex"
>
  <TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
  <div class="[&>div]:!text-current">
    <AccountEntries
      {accountId}
      {projectId}
      labelText="Entries on these datasets will be unassigned from this account:"
    />
  </div>
</div>
