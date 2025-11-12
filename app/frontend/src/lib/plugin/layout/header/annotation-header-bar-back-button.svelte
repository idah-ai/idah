<script lang="ts">
  import { ArrowLeftIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  type Props = {
    context: IActivityContext;
  };

  let { context }: Props = $props();
</script>

<Button variant="outline" size="sm" onclick={context.back}>
  <ArrowLeftIcon />
  Back
</Button>
