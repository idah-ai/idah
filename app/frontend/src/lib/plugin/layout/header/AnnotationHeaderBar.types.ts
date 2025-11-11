import type { Component } from "svelte";

export interface AnnotationHeaderBarBaseTool {
  label: string;
  icon?: Component;
  iconName?: string;
  handleClick: () => void;
}
