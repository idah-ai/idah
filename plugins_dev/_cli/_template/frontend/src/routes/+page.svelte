<script lang="ts">
  import Plugin from "$lib/plugin/plugin.svelte";
  import { activityContextExample } from "./activity-context-example";
  import Header from "./header.svelte";
</script>

<div class="relative">
  <Header />
  <div style="height: calc(-37px + 100vh);">
    <Plugin context={activityContextExample} />
  </div>
</div>
