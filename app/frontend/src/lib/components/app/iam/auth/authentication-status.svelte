<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import ApplicationLoading from "@/components/app/application/application-loading.svelte";

  import { cn } from "@/utils";

  // Props
  interface Props {
    class?: string | null;
    // Slots
    loading?: Snippet;
    authorized?: Snippet;
    unauthorized?: Snippet;
  }
  let { class: className, loading, authorized, unauthorized }: Props = $props();

  // Lifecycle
  onMount(async () => {
    await checkAuthStatus();
  });

  // Functions
  async function checkAuthStatus(): Promise<void> {}
</script>

<div class={cn("", className)}>
  <!-- {#if loading}
		{@render loading?.()}
	{:else}
		<ApplicationLoading />
	{/if} -->

  {@render authorized?.()}

  <!-- {#if unauthorized}
		{@render unauthorized?.()}
	{:else}
		<Redirect to="/login" />
	{/if} -->
</div>
