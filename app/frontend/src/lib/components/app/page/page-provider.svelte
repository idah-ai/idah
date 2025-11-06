<script lang="ts">
  import { onMount } from "svelte";

  import ApplicationHeader from "@/components/app/application/application-header.svelte";

  import type { WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";

  // Props
  type Props = WithElementRef<HTMLAttributes<HTMLElement>> & {
    name: string; // Name of the page
    // action: Action;
    // resource: Resource;
    // scopes: Scope[];
    // roles: Role[];
    // redirectTo?: string;
  };
  let { ref, children, name }: Props = $props();

  // Variables
  let hasAccess: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    // const currentAccount = $authStatus.authContext;
    // if (await checkRights(action, resource, scopes, roles)) {
    // hasAccess = true;
    // } else {
    hasAccess = true;
    // }
  });
</script>

{#if hasAccess}
  <ApplicationHeader></ApplicationHeader>

  <section id={name} bind:this={ref} class="flex flex-col gap-4">
    {@render children?.()}
  </section>
{/if}
