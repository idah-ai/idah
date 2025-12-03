<script lang="ts">
  import ApplicationHeader from "@/components/app/application/application-header.svelte";
  import Redirect from "@/components/app/misc/redirect.svelte";
  import ShowToast from "@/components/app/misc/show-toast.svelte";

  import { authStatus } from "@/security/AuthContext";

  import type { WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Role } from "@/data/model/iam/accounts/auth/constants";

  // Props
  type Props = WithElementRef<HTMLAttributes<HTMLElement>> & {
    name: string; // Name of the page
    // action: Action;
    // resource: Resource;
    // scopes: Scope[];
    roles?: Array<Role>;
    redirectTo?: string;
  };
  let { ref, children, name, roles, redirectTo = "/" }: Props = $props();

  // Functions
  async function checkAccess() {
    const currentAccount = $authStatus.authContext;

    if (!currentAccount) {
      return false;
    }

    if (roles) {
      return roles.includes(currentAccount.roleName);
    }

    // if (await checkRights(action, resource, scopes, roles)) {
    // hasAccess = true;
    // } else {

    return true;
    // }
  }
</script>

{#await checkAccess() then hasAccess}
  {#if hasAccess}
    <ApplicationHeader />

    <section id={name} bind:this={ref} class="flex flex-col gap-4">
      {@render children?.()}
    </section>
  {:else}
    <ShowToast type="error" title="Access Denied" description="You do not have access to this page." />
    <Redirect to={redirectTo} />
  {/if}
{/await}
