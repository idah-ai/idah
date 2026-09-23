<script lang="ts">
  import type { Snippet } from "svelte";

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

  // Re-evaluate whenever auth state or any input prop changes (not just once
  // on mount). The cancelled flag drops a stale async result if inputs change
  // before can() resolves.
  $effect(() => {
    const currentAccount = $authStatus.authContext;
    const currentAction = action;
    const currentResource = resource;
    const currentScopes = scopes;
    const currentRoles = roles;

    let cancelled = false;

    (async () => {
      if (!currentAccount) {
        hasAccess = false;
        return;
      }

      const allowed = (await currentAccount.can(currentAction, currentResource, currentScopes)) || false;
      // AND semantics: roles only narrows the server-authoritative can()
      // result, it never widens it.
      const roleOk = currentRoles?.length ? currentRoles.includes(currentAccount.roleName) : true;

      if (!cancelled) hasAccess = allowed && roleOk;
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

{#if hasAccess}
  {@render children()}
{:else}
  {@render noAccess?.()}
{/if}
