import type { Hash } from "$lib/utils/types";

export type ErrorClassDetail = {
  title: string;
  fallbackMessage: string;
};

export type ErrorClasses = Hash<ErrorClassDetail>;
