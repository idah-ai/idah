import type { Component } from "svelte";

import type { ButtonVariant } from "@/components/ui/button/button.svelte";

/** Universal outcome shared by every confirm modal. */
export const ConfirmModalChoice = {
  Confirm: "confirm",
  Cancel: "cancel",
} as const;
export type ConfirmModalChoice = (typeof ConfirmModalChoice)[keyof typeof ConfirmModalChoice];

/**
 * Returned by an action's `run` to control the modal. Returning nothing means success and
 * the modal closes.
 *
 * Mirrors the convention already used by `entry-actions.ts` ("false on failure, toast
 * already shown"): failures are reported by the caller and signalled by a return value,
 * never by throwing.
 */
export const confirmModalResult = {
  KeepOpen: "keep-open",
} as const;
export type ConfirmModalResult = (typeof confirmModalResult)[keyof typeof confirmModalResult];

/**
 * Async work owned by an action.
 *
 * Runs while the modal stays open in a pending state. Return `confirmModalResult.KeepOpen`
 * to keep it open (the caller has already shown its own error toast); return nothing to
 * close. Throwing is treated as `KeepOpen` and logged — it is a safety net so an unhandled
 * rejection cannot silently close a destructive modal, not the failure channel.
 *
 * `run` must not navigate: it executes while the modal is open, so a `goto()` here can
 * trigger a navigation guard that opens a second modal. Navigate after `showConfirmModal()`
 * resolves instead.
 */
export type ConfirmModalRun = () => Promise<ConfirmModalResult | void> | ConfirmModalResult | void;

export interface ConfirmModalAction<Id extends string = string> {
  /** Returned by `showConfirmModal()` when this action is chosen. */
  id: Id;
  label: string;
  variant?: ButtonVariant;
  /** Present selects async mode for this action; absent closes the modal immediately. */
  run?: ConfirmModalRun;
  /** Button label while `run` is in flight. Defaults to the action's own label. */
  pendingLabel?: string;
}

export interface ConfirmModalContent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload props are caller-defined
  component: Component<any>;
  /** Captured when `showConfirmModal()` is called; NOT live-bound to the caller's state. */
  props?: Record<string, unknown>;
}

export interface ConfirmModalOptions<Id extends string = never> {
  title: string;
  description?: string;
  /** Extra body content rendered between the description and the footer. */
  content?: ConfirmModalContent;

  /** Multi-outcome dialogs. Omit for a single confirm button. Mode is decided per action. */
  actions?: readonly ConfirmModalAction<Id>[];

  /** Single-action sugar. Ignored when `actions` is provided. */
  confirmLabel?: string;
  /** Single-action sugar. Its presence selects async mode. Ignored when `actions` is provided. */
  onConfirm?: ConfirmModalRun;
  /** Single-action sugar. Ignored when `actions` is provided. */
  pendingLabel?: string;
  /** Styles the default confirm button. Ignored when `actions` is provided. */
  destructive?: boolean;

  cancelLabel?: string;
}

/** What `showConfirmModal()` resolves to: the chosen action's id, or `"cancel"`. */
export type ConfirmModalChoiceOf<Id extends string> = [Id] extends [never]
  ? ConfirmModalChoice
  : Id | typeof ConfirmModalChoice.Cancel;

/** An action with every default resolved, as held by the store and rendered by the host. */
export interface ResolvedConfirmModalAction {
  id: string;
  label: string;
  variant: ButtonVariant;
  pendingLabel: string;
  run?: ConfirmModalRun;
}

/** The active request, as held by the store and rendered by the host. */
export interface ConfirmModalRequest {
  id: number;
  title: string;
  description?: string;
  content?: ConfirmModalContent;
  actions: ResolvedConfirmModalAction[];
  cancelLabel: string;
}
