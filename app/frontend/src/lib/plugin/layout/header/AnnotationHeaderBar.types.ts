import type { Component } from "svelte";

export interface AnnotationHeaderBarBaseTool {
  label: string;
  icon: Component;
  isActive?: boolean;
  handleClick: () => void;
}
