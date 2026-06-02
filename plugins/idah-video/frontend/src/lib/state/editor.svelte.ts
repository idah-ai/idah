import { getDriver } from './driver.svelte';

const EDITABLE_STEPS = ['annotate', 'review'];

export function isEditable(): boolean {
  return EDITABLE_STEPS.includes(getDriver().workflowStep);
}
