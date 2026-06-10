import type { Snippet } from "svelte";

import type { ModalBaseProps } from "@/components/app/overlays/modals/Modal.types";

export type FormModalAction = "create" | "update";

export interface FormModalBaseProps extends ModalBaseProps {
  action: FormModalAction;
  title?: string;
  description?: string;
  loading?: boolean;
  disabled?: boolean;
  actions?: Snippet;
  confirm?: Snippet;
  canClickOutside?: boolean;
  onCancel?: () => Promise<void> | void;
  onConfirm?: () => Promise<void> | void;
  class?: string;
}
