import { getDriver, syncStatus } from './driver.svelte';

const EDITABLE_STEPS = ['annotate', 'review'];

export function isEditable(): boolean {
  if (syncStatus.error !== null) return false;
  return EDITABLE_STEPS.includes(getDriver().workflowStep);
}
