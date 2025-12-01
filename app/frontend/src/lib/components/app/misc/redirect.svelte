<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  // Props
  interface Props {
    to?: string;
  }
  let { to = "/" }: Props = $props();

  onMount(() => {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(to);
  });
</script>
