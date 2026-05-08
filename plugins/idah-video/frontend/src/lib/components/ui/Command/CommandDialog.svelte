<script lang="ts">
  import type {
    Command as CommandPrimitive,
    Dialog as DialogPrimitive,
  } from "bits-ui";
  import type { Snippet } from "svelte";
  import Command from "./Command.svelte";
  import * as Dialog from "$lib/components/ui/Dialog/index.js";
  import type { WithoutChildrenOrChild } from "$lib/utils.js";

  let {
    open = $bindable(false),
    ref = $bindable(null),
    value = $bindable(""),
    title = "Command Palette",
    description = "Search for a command to run",
    portalProps,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.RootProps> &
    WithoutChildrenOrChild<CommandPrimitive.RootProps> & {
      portalProps?: DialogPrimitive.PortalProps;
      children: Snippet;
      title?: string;
      description?: string;
    } = $props();
</script>

<Dialog.Root bind:open {...restProps}>
  <Dialog.Header class="sr-only">
    <Dialog.Title>{title}</Dialog.Title>
    <Dialog.Description>{description}</Dialog.Description>
  </Dialog.Header>
  <Dialog.Content class="overflow-hidden p-0" {portalProps}>
    <Command
      **:data-[slot=command-input-wrapper]:h-8 [&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 [&_[data-command-group]]:px-1 [&_[data-command-input-wrapper]_svg]:h-3.5 [&_[data-command-input-wrapper]_svg]:w-3.5 [&_[data-command-input]]:h-8 [&_[data-command-input]]:text-xs [&_[data-command-item]]:px-1.5 [&_[data-command-item]]:py-1 [&_[data-command-item]_svg]:h-4 [&_[data-command-item]_svg]:w-4
      {...restProps}
      bind:value
      bind:ref
      {children}
    />
  </Dialog.Content>
</Dialog.Root>
