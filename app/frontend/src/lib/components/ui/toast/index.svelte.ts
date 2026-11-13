import CustomToast from "@/components/ui/toast/custom-toast.svelte";

import { toast } from "svelte-sonner";

export type CustomToastType = "default" | "info" | "success" | "warning" | "error";

export interface CustomToastOptions {
  id?: string | number;
  type?: CustomToastType;

  title: string;
  description?: string;

  dismissable?: boolean; // default: false
  /** How long (ms) to keep the toast visible; Infinity keeps it until dismissed. */
  duration?: number;
}

function getRandomUUID(): string {
  return crypto.randomUUID();
}

/** Dismiss a toast by its id (e.g. one shown with a fixed id). */
export function dismissToast(id: string | number): void {
  toast.dismiss(id);
}

export const showToast = {
  default: (toastOptions: CustomToastOptions) => {
    const id = toastOptions.id ?? getRandomUUID();
    toast(CustomToast, {
      id,
      duration: toastOptions.duration,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "default",
        },
      },
    });
  },
  success: (toastOptions: CustomToastOptions) => {
    const id = toastOptions.id ?? getRandomUUID();
    toast.success(CustomToast, {
      id,
      duration: toastOptions.duration,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "success",
        },
      },
    });
  },
  info: (toastOptions: CustomToastOptions) => {
    const id = toastOptions.id ?? getRandomUUID();
    toast.info(CustomToast, {
      id,
      duration: toastOptions.duration,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "info",
        },
      },
    });
  },
  warning: (toastOptions: CustomToastOptions) => {
    const id = toastOptions.id ?? getRandomUUID();
    toast.warning(CustomToast, {
      id,
      duration: toastOptions.duration,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "warning",
        },
      },
    });
  },
  error: (toastOptions: CustomToastOptions) => {
    const id = toastOptions.id ?? getRandomUUID();
    toast.error(CustomToast, {
      id,
      duration: toastOptions.duration,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "error",
        },
      },
    });
  },
};
