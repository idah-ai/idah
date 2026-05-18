import { writable } from "svelte/store";

type ResolveFn = (value: boolean) => void;

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  dismissable?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  dismissable?: boolean;
  onConfirm?: () => Promise<void> | void;
}

let resolvePromise: ResolveFn | null = null;

export const confirmDialogState = writable<ConfirmDialogState>({
  open: false,
  title: "",
  description: "",
  dismissable: false,
  onConfirm: () => {},
  onCancel: () => {},
});

export function showConfirmDialog(props: ConfirmDialogProps): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
    confirmDialogState.set({
      ...props,
      open: true,
      onConfirm: () => {
        if (props.onConfirm) {
          props.onConfirm();
        }
        resolve(true);
        resolvePromise = null;
      },
      onCancel: () => {
        resolve(false);
        resolvePromise = null;
      },
    });
  });
}

export function closeConfirmDialog() {
  if (resolvePromise) {
    resolvePromise(false);
    resolvePromise = null;
  }
  confirmDialogState.set({
    open: false,
    title: "",
    description: "",
    dismissable: false,
    onConfirm: () => {},
    onCancel: () => {},
  });
}
