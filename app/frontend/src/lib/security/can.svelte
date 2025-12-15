<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import { authStatus } from "@/security/AuthContext";

  import type { Role } from "@/data/model/iam/accounts/auth/constants";
  import type { Action, Resource, Scope } from "@/security/types";

  // Props
  interface Props {
    action: Action;
    resource: Resource;
    scopes?: Scope[];
    roles?: Role[];
    children: Snippet;
    noAccess?: Snippet;
  }
  let { action, resource, scopes, roles, children, noAccess }: Props = $props();

  // Variables
  let hasAccess: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;

    if (!currentAccount) {
      hasAccess = false;
      return;
    }

    hasAccess = (await currentAccount?.can(action, resource, scopes)) || false;

    if (roles?.length) {
      hasAccess = roles.includes(currentAccount.roleName);
    }
  });
</script>

{#if hasAccess}
  {@render children()}
{:else}
  {@render noAccess?.()}
{/if}
