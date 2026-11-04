<script lang="ts">
  import { page } from "$app/state";
  import { authStatus } from "@/security/AuthContext";
  import Dashboard from "@/components/app/projects/dashboard/Dashboard.svelte";
</script>

{#key $authStatus.authContext}
  {#key page.params.projectId}
    <Dashboard projectId={page.params.projectId as string} />
  {/key}
{/key}
