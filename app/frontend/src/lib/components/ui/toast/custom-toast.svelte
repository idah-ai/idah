<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import type { CustomToastOptions } from "@/components/ui/toast/index.svelte";
  import { cn } from "@/utils";

  // Props
  interface Props {
    toastOptions: CustomToastOptions;
  }
  let { toastOptions }: Props = $props();

  // Variables
  let { id: toastId, type, title, description, dismissable = true } = $derived(toastOptions);
</script>

<div class="flex text-sm">
  <div class="flex flex-col">
    <!-- TITLE -->
    <h6 class="font-semibold">{title}</h6>

    <!-- DESCRIPTION -->
    {#if description}
      <p class="text-xs font-normal">{description}</p>
    {/if}
  </div>

  {#if dismissable}
    <button
      class={cn("absolute -top-2 -right-2 flex size-5 cursor-pointer items-center justify-center rounded-full border", {
        "bg-background": type === "default",
        "bg-[#EFF8FE]": type === "info",
        "bg-[#EDFDF3]": type === "success",
        "bg-[#FFFCF0]": type === "warning",
        "bg-[#FFEFF0]": type === "error",
      })}
      onclick={() => {
        toast.dismiss(toastId);
      }}
    >
      <XIcon class="size-3" />
    </button>
  {/if}
</div>
