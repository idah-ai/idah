<script lang="ts">
  import { onMount } from "svelte";

  import Button from "@/components/ui/button/button.svelte";
  import { Dialog } from "@/components/ui/dialog";
  import DialogClose from "@/components/ui/dialog/dialog-close.svelte";
  import DialogContent from "@/components/ui/dialog/dialog-content.svelte";
  import DialogDescription from "@/components/ui/dialog/dialog-description.svelte";
  import DialogFooter from "@/components/ui/dialog/dialog-footer.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";
  import Spinner from "@/components/app/loading/spinner.svelte";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  let {
    action,
    open = $bindable(),
    title,
    description,
    loading,
    onCancel,
    onConfirm,
    modalTitle,
    modalDescription,
    actions,
    confirm,
    children,
  }: FormModalBaseProps = $props();

  // Types
  interface ConfirmButtonProps {
    label: string;
    loadingLabel: string;
  }

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let derivedTitle: string = $derived(newRecord ? `Add New ${title}` : `Edit ${title}`);
  let confirmButtonProps: ConfirmButtonProps = $derived.by(() => getConfirmButtonProps());

  // Functions
  function getConfirmButtonProps(): ConfirmButtonProps {
    switch (action) {
      case "create":
        return { label: `Create ${title}`, loadingLabel: `Creating ${title?.toLocaleLowerCase()}...` };
      case "update":
        return { label: `Save Changes`, loadingLabel: `Saving...` };
    }
  }

  async function handleClickCancel(): Promise<void> {
    open = false;

    await onCancel?.();
  }

  async function handleClickConfirm(): Promise<void> {
    await onConfirm?.();
  }

  async function handleOpenChangeComplete(isOpen: boolean): Promise<void> {
    if (!isOpen) {
      await onCancel?.();
    }
  }

  // Lifecycle
  onMount(() => {
    function handlePressEnter(event: KeyboardEvent) {
      if (event.key === "Enter" && !event.shiftKey && !loading) {
        event.preventDefault();
        handleClickConfirm();
      }
    }

    window.addEventListener("keydown", handlePressEnter);

    return () => {
      window.removeEventListener("keydown", handlePressEnter);
    };
  });
</script>

<Dialog bind:open onOpenChangeComplete={handleOpenChangeComplete}>
  <DialogContent>
    {#if modalTitle}
      {@render modalTitle()}
    {:else}
      <DialogTitle>{derivedTitle}</DialogTitle>
    {/if}

    {#if modalDescription}
      {@render modalDescription()}
    {:else}
      <DialogDescription>{description}</DialogDescription>
    {/if}

    <ScrollArea class="max-h-[80vh]">
      {@render children?.()}
    </ScrollArea>

    <DialogFooter>
      {#if actions}
        {@render actions()}
      {:else}
        <div class="flex gap-2">
          <DialogClose>
            <Button variant="outline" class="w-full lg:w-auto" onclick={handleClickCancel}>Cancel</Button>
          </DialogClose>

          {#if confirm}
            {@render confirm()}
          {:else}
            <Button class="gap-2" onclick={handleClickConfirm}>
              {#if loading}
                <Spinner variant="primary-foreground" size="sm" />
                {confirmButtonProps.loadingLabel}
              {:else}
                {confirmButtonProps.label}
              {/if}
            </Button>
          {/if}
        </div>
      {/if}
    </DialogFooter>
  </DialogContent>
</Dialog>
