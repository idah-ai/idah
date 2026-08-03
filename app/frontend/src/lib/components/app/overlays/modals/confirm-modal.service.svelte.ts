import { browser } from "$app/environment";

import {
  ConfirmModalChoice,
  ConfirmModalResult,
  type ConfirmModalChoiceOf,
  type ConfirmModalOptions,
  type ConfirmModalRequest,
  type ResolvedConfirmModalAction,
} from "@/components/app/overlays/modals/confirm-modal.types";

/**
 * Global confirm-modal service.
 *
 * One `<ConfirmModal />` renders from the root layout; callers ask for a confirmation
 * through {@link showConfirmModal} and never hold modal state themselves.
 *
 * Lifecycle is hybrid and chosen per action by the presence of `run`:
 * - no `run`  → the modal closes as soon as the action is clicked
 * - has `run` → the modal stays open in a pending state and closes only when `run` resolves
 *   without returning `ConfirmModalResult.KeepOpen`
 */
class ConfirmModalStore {
  /** The active request, or null when idle. Cleared after the exit animation completes. */
  request: ConfirmModalRequest | null = $state(null);

  /** Drives the underlying `AlertDialog`. Goes false before `request` is cleared. */
  open: boolean = $state(false);

  /** Id of the action whose `run` is in flight, or null. */
  pendingActionId: string | null = $state(null);
}

export const confirmModalStore = new ConfirmModalStore();

/**
 * Resolver of the promise handed to the current caller. Deliberately NOT reactive — it is
 * control state, not render state. Nulled the moment a request settles, which is also what
 * makes {@link cancelConfirmModal} and late `run` results idempotent.
 */
let activeResolve: ((choice: string) => void) | null = null;

let nextRequestId = 0;

function resolveActions(options: ConfirmModalOptions<string>): ResolvedConfirmModalAction[] {
  if (options.actions?.length) {
    return options.actions.map((action) => ({
      id: action.id,
      label: action.label,
      variant: action.variant ?? "default",
      pendingLabel: action.pendingLabel ?? action.label,
      run: action.run,
    }));
  }

  const label = options.confirmLabel ?? "Confirm";

  return [
    {
      id: ConfirmModalChoice.Confirm,
      label,
      variant: options.destructive === false ? "default" : "destructive",
      pendingLabel: options.pendingLabel ?? label,
      run: options.onConfirm,
    },
  ];
}

/** Settles the active request and starts the close transition. No-op when already settled. */
function finish(choice: string): void {
  const resolve = activeResolve;
  if (!resolve) return;

  activeResolve = null;
  confirmModalStore.pendingActionId = null;
  confirmModalStore.open = false;
  resolve(choice);
}

/**
 * Ask the user to confirm something.
 *
 * @returns the chosen action's id, or `ConfirmModalChoice.Cancel` if the user cancelled,
 * pressed Escape, or navigated away.
 * @throws if another confirm modal is already active — confirmations are strictly
 * sequential, and a silently dropped one would be indistinguishable from a cancel.
 */
export function showConfirmModal<Id extends string = never>(
  options: ConfirmModalOptions<Id>,
): Promise<ConfirmModalChoiceOf<Id>> {
  if (!browser) {
    if (import.meta.env.DEV) {
      console.error(`showConfirmModal: "${options.title}" called during SSR; resolving as cancelled.`);
    }
    return Promise.resolve(ConfirmModalChoice.Cancel as ConfirmModalChoiceOf<Id>);
  }

  /**
   * Gate on "is someone awaiting a decision?", not "is a modal on screen?".
   *
   * `request` deliberately outlives the promise: it stays set through the exit animation so
   * the closing modal has something to render. Gating on it would reject the perfectly legal
   * `await showConfirmModal(A); showConfirmModal(B);` for as long as that animation runs.
   */
  if (activeResolve) {
    throw new Error(
      `showConfirmModal: "${options.title}" was called while "${confirmModalStore.request?.title}" is still active.`,
    );
  }

  confirmModalStore.request = {
    id: ++nextRequestId,
    title: options.title,
    description: options.description,
    content: options.content,
    actions: resolveActions(options as ConfirmModalOptions<string>),
    cancelLabel: options.cancelLabel ?? "Cancel",
  };
  confirmModalStore.pendingActionId = null;
  confirmModalStore.open = true;

  return new Promise<ConfirmModalChoiceOf<Id>>((resolve) => {
    activeResolve = resolve as (choice: string) => void;
  });
}

/**
 * Run an action on behalf of the host.
 *
 * Sync actions settle immediately. Async actions hold the modal open in a pending state
 * while `run` executes, then close unless `run` returned `ConfirmModalResult.KeepOpen`.
 */
export async function selectConfirmModalAction(actionId: string): Promise<void> {
  const request = confirmModalStore.request;
  if (!request || confirmModalStore.pendingActionId) return;

  const action = request.actions.find((candidate) => candidate.id === actionId);
  if (!action) return;

  if (!action.run) {
    finish(action.id);
    return;
  }

  confirmModalStore.pendingActionId = action.id;

  let result: ConfirmModalResult | void;
  try {
    result = await action.run();
  } catch (error) {
    console.error(
      `showConfirmModal: action "${action.id}" of "${request.title}" threw instead of returning ` +
        `ConfirmModalResult.KeepOpen. Keeping the modal open.`,
      error,
    );
    result = ConfirmModalResult.KeepOpen;
  }

  /**
   * The request may have settled while `run` was in flight — the user can still cancel
   * during pending, because a hung request would otherwise trap them (BackendDataSource has
   * no timeout). A late result must not resolve or close anything.
   */
  if (!activeResolve || confirmModalStore.request?.id !== request.id) return;

  confirmModalStore.pendingActionId = null;
  if (result === ConfirmModalResult.KeepOpen) return;

  finish(action.id);
}

/**
 * Whether a confirm modal is currently asking the user something.
 *
 * For re-entrant callers that can fire again while their own modal is open — a
 * `beforeNavigate` guard is the real case, since the overlay blocks clicks but not the
 * browser's Back button. Those must bail out rather than call {@link showConfirmModal}
 * again, which throws by design.
 */
export function isConfirmModalActive(): boolean {
  return confirmModalStore.request !== null;
}

/**
 * Cancel the active request. Backs the Cancel button, Escape, and route changes.
 *
 * While an action is pending the Cancel button and Escape are both disabled, so the only
 * caller left is a route change. That path still abandons the modal rather than the in-flight
 * mutation, which keeps running and reports through its own toasts — hence the staleness
 * guard in {@link selectConfirmModalAction}.
 */
export function cancelConfirmModal(): void {
  finish(ConfirmModalChoice.Cancel);
}

/**
 * Clear the request once the close transition has finished.
 *
 * Must not run earlier: bits-ui keeps the content mounted through the exit animation, so
 * clearing on close would blank the modal mid-fade.
 *
 * Fires after the open transition too, hence the `open` guard. The `activeResolve` guard
 * covers the other direction: a new request may have opened during the exit animation, and
 * a late completion from the request it replaced must not clear it.
 */
export function settleConfirmModal(open: boolean): void {
  if (open || activeResolve) return;

  confirmModalStore.request = null;
  confirmModalStore.pendingActionId = null;
}
