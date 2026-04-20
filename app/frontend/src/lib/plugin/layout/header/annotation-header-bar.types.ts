import type { Component } from "svelte";

export interface AnnotationHeaderBarBaseTool {
  name: string;
  label: string;
  icon?: Component;
  iconName?: string;
  isActive?: boolean;
  disabled?: boolean;
  handleClick: () => void;
}
