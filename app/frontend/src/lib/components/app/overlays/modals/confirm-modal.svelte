<script lang="ts">
  import { afterNavigate } from "$app/navigation";

  import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
  import Button from "@/components/ui/button/button.svelte";

  import {
    cancelConfirmModal,
    confirmModalStore,
    selectConfirmModalAction,
    settleConfirmModal,
  } from "@/components/app/overlays/modals/confirm-modal.service.svelte";

  // Variables
  let pending = $derived(confirmModalStore.pendingActionId !== null);

  // Lifecycle
  /** Never leave a modal orphaned over a page it was not opened from. */
  afterNavigate(() => cancelConfirmModal());
</script>

<AlertDialog
  bind:open={confirmModalStore.open}
  onOpenChange={(open) => {
    /* Covers the Cancel button and Escape; a programmatic close has already settled. */
    if (!open) cancelConfirmModal();
  }}
  onOpenChangeComplete={settleConfirmModal}
>
  {#if confirmModalStore.request}
    {@const request = confirmModalStore.request}

    <AlertDialogContent
      onEscapeKeydown={(event) => {
        /* An action is mid-flight: Cancel remains available, Escape does not. */
        if (pending) event.preventDefault();
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{request.title}</AlertDialogTitle>
      </AlertDialogHeader>

      {#if request.description}
        <AlertDialogDescription>{request.description}</AlertDialogDescription>
      {/if}

      {#if request.content}
        {@const Content = request.content.component}
        <!--
          Keyed on the request, not just guarded by {#if}: a new request can replace this one
          without `request` passing through null, because it stays set through the exit
          animation. Without the key, Svelte would reuse the previous content instance —
          along with any state or in-flight fetch it owns.
        -->
        {#key request.id}
          <Content {...request.content.props ?? {}} />
        {/key}
      {/if}

      <AlertDialogFooter>
        <!--
          Disabled while an action runs: cancelling would only hide the dialog, not abort the
          mutation, leaving the caller unable to tell whether its work completed.

          Both props are needed. bits-ui consumes `disabled` internally to block its own
          click/keydown handlers but never forwards it to the element, so `aria-disabled`
          is what actually reaches the DOM — and `buttonVariants` already styles it
          (`aria-disabled:pointer-events-none aria-disabled:opacity-50`).
        -->
        <AlertDialogCancel disabled={pending} aria-disabled={pending || undefined}>
          {request.cancelLabel}
        </AlertDialogCancel>

        {#each request.actions as action (action.id)}
          <Button
            variant={action.variant}
            loading={confirmModalStore.pendingActionId === action.id}
            loadingLabel={action.pendingLabel}
            disabled={pending && confirmModalStore.pendingActionId !== action.id}
            onclick={() => selectConfirmModalAction(action.id)}
          >
            {action.label}
          </Button>
        {/each}
      </AlertDialogFooter>
    </AlertDialogContent>
  {/if}
</AlertDialog>
