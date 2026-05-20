import { writable } from "svelte/store";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  dismissable?: boolean;
  onConfirm: () => Promise<void> | void;
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  dismissable?: boolean;
  onConfirm: () => Promise<void> | void;
}

export const confirmDialogState = writable<ConfirmDialogState>({
  open: false,
  title: "",
  description: "",
  dismissable: false,
  onConfirm: () => {},
});

export function showConfirmDialog(props: ConfirmDialogProps) {
  confirmDialogState.set({ ...props, open: true });
}

export function closeConfirmDialog() {
  confirmDialogState.set({
    open: false,
    title: "",
    description: "",
    dismissable: false,
    onConfirm: () => {},
  });
}
