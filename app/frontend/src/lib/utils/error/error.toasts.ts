import { toast } from "svelte-sonner";

import { errorClasses } from "$lib/utils/error/error.classes";

import type { JsonApiErrorResponse } from "$lib/data/model/types";
import type { ErrorClassDetail } from "$lib/utils/error/error.classes.types";
import type { ShowUnexpectedErrorToastParams } from "$lib/utils/error/error.toasts.types";
import type { Hash } from "$lib/utils/types";

type ErrorToastOptions = {
  title?: string;
  message?: string;
  error?: Hash;
};

export function showErrorToast(errorToastOptions: ErrorToastOptions) {
  const { title, message } = errorToastOptions;

  const fallbackTitle: string = "Sorry, something went wrong!";
  const fallbackMessage: string = "Please try again later.";

  const errorClass: ErrorClassDetail | null = title ? errorClasses[title] : null;
  const errorClassTitle: string = errorClass ? errorClass.title : fallbackTitle;
  const errorClassMessage: string = message ? message : errorClass?.fallbackMessage || fallbackMessage;

  toast.error(errorClassTitle, {
    description: errorClassMessage,
    richColors: true,
  });
}

export function showUnexpectedErrorToast(params: ShowUnexpectedErrorToastParams) {
  const { error } = params;
  const err = error as JsonApiErrorResponse;

  if (!err.errors) return;

  err.errors.forEach((e) => {
    showErrorToast({
      title: e.title,
      message: e.detail,
      error: e,
    });
  });
}

export function showActionFailedToast(error: unknown) {
  console.error(error);

  toast.error("Action failed", {
    description:
      "The action could not be completed, please try again later. If the problem continues, please contact support.",
    richColors: true,
  });
}
