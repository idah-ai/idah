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
    /** When set (with `minRole`), decide on the actor's effective rank on the
     *  concrete project instead of the scope list. This avoids granting an
     *  org_owner org_owner powers on a foreign project where they are only a
     *  member. */
    projectId?: string;
    minRole?: string;
    children: Snippet;
    noAccess?: Snippet;
  }
  let { action, resource, scopes, roles, projectId, minRole, children, noAccess }: Props = $props();

  // Variables
  let hasAccess: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;

    if (!currentAccount) {
      hasAccess = false;
      return;
    }

    if (projectId && minRole) {
      hasAccess = await currentAccount.canOnProject(action, resource, projectId, minRole);
    } else {
      hasAccess = (await currentAccount?.can(action, resource, scopes)) || false;
    }

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
