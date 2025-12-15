<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  // Props
  interface Props {
    type: "success" | "error" | "info" | "warning";
    title: string;
    description?: string;
  }
  let { type, title, description }: Props = $props();

  onMount(() => {
    switch (type) {
      case "success": {
        toast.success(title, { description });
        break;
      }
      case "error": {
        toast.error(title, { description });
        break;
      }
      case "info": {
        toast.info(title, { description });
        break;
      }
      case "warning": {
        toast.warning(title, { description });
        break;
      }
    }
  });
</script>
