<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";

  import * as Dialog from "@/components/ui/dialog";

  let {
    ref = $bindable(null),
    class: className,
    portalProps,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
    portalProps?: DialogPrimitive.PortalProps;
    overlayClass?: string | null;
    children: Snippet;
  } = $props();
</script>

<Dialog.Portal {...portalProps}>
  <DialogPrimitive.Content
    bind:ref
    data-slot="dialog-content"
    class={cn(
      "bg-background data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0 fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border p-6 shadow-lg duration-200 data-[state=open]:animate-none sm:max-w-lg",
      className,
    )}
    {...restProps}
  >
    {@render children?.()}
  </DialogPrimitive.Content>
</Dialog.Portal>
