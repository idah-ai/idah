<script lang="ts">
  import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
  import { AlertCircleIcon } from "@lucide/svelte";

  // Props
  interface Props {
    title: string;
    description: string;
  }
  let { title, description }: Props = $props();
</script>

<Alert variant="destructive" class="bg-destructive/5 border-destructive mb-6">
  <AlertCircleIcon />
  <AlertTitle>{title}</AlertTitle>
  <AlertDescription>{description}</AlertDescription>
</Alert>