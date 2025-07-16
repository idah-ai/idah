import type { Hash } from "@/utils/types";

export type ErrorClassDetail = {
  title: string;
  fallbackMessage: string;
};

export type ErrorClasses = Hash<ErrorClassDetail>;
