import type { Snippet } from "svelte";

import type { ModalBaseProps } from "@/components/app/overlays/modals/Modal.types";

export type FormModalAction = "create" | "update";

export interface FormModalBaseProps extends ModalBaseProps {
  action: FormModalAction;
  title?: string;
  description?: string;
  loading?: boolean;
  disabled?: boolean;
  closeOnOutsideClick?: boolean;
  actions?: Snippet;
  confirm?: Snippet;
  canClickOutside?: boolean;
  // While true, the modal can't be dismissed (no close button, Escape or outside click),
  // e.g. while an upload is running and would keep going behind a closed modal.
  preventClose?: boolean;
  onCancel?: () => Promise<void> | void;
  onConfirm?: () => Promise<void> | void;
  class?: string;
}
