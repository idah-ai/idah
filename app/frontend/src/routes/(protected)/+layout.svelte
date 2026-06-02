<script lang="ts">
  import AuthenticationStatus from "@/components/app/iam/auth/authentication-status.svelte";
  let { children } = $props();
</script>

<AuthenticationStatus>
  {#snippet authorized()}
    {@render children?.()}
  {/snippet}
</AuthenticationStatus>
