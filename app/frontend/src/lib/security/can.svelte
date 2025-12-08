<!-- <script lang="ts">
  import { onMount } from "svelte";

  import { AuthContext, authStatus } from "$/lib/security/AuthContext";
  import { checkRights } from "$/lib/security/CheckRights";

  import type { Action } from "$/lib/security/can.types";
  import type { Resource } from "$/lib/security/resource.types";
  import type { RoleValue } from "$/lib/data/model/iam/role/role.constants";
  import type { Scope } from "$/lib/security/scope.types";

  export let resource: Resource;
  export let action: Action;
  export let scopes: Scope[] | undefined = undefined;

  export let roles: RoleValue[] | undefined = undefined;

  let hasAccess = false;

  onMount(async () => {
    const authContext: AuthContext | null = $authStatus.authContext;

    if (await checkRights(authContext, action, resource, scopes, roles)) {
      hasAccess = true;
    }
  });
</script>

{#if hasAccess}
  <slot />
{:else}
  <slot name="else" />
{/if} -->

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
  onMount(() => {
    const currentAccount = $authStatus.authContext;

    hasAccess = currentAccount?.can(action, resource, scopes) || false;
  });
</script>

{#if hasAccess}
  {@render children()}
{:else}
  {@render noAccess?.()}
{/if}
