<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import { truncate } from "@/utils/string";

  // Props
  interface Props {
    name: string;
  }
  let { name }: Props = $props();
</script>

<Button variant="ghost" size="sm">
  {truncate(name, 90)}
</Button>
