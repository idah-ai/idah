import { writable } from "svelte/store";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  dismissable?: boolean;
  onConfirm: () => Promise<void> | void;
  /** Called when the dialog is dismissed without confirming. */
  onCancel?: () => void;
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  dismissable?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

export const confirmDialogState = writable<ConfirmDialogState>({
  open: false,
  title: "",
  description: "",
  dismissable: false,
  onConfirm: () => {},
  onCancel: () => {},
});

export function showConfirmDialog(props: ConfirmDialogProps) {
  confirmDialogState.set({ ...props, open: true });
}

export function hideConfirmDialog() {
  confirmDialogState.update((s) => ({ ...s, open: false }));
}

export function closeConfirmDialog() {
  confirmDialogState.set({
    open: false,
    title: "",
    description: "",
    dismissable: false,
    onConfirm: () => {},
    onCancel: () => {},
  });
}
