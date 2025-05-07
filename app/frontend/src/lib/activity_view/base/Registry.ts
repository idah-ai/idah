import { act } from '@testing-library/svelte';
import { type ActivityView } from './ActivityView';

export const Registry = {
  activityViews: {} as { [name : string] : ActivityView },

  registerActivityView(activityView: ActivityView) {
    const existingActivityView = this.activityViews[activityView.name];
    if(existingActivityView !== undefined && existingActivityView !== activityView) {
        throw new Error(`ActivityView ${activityView.name} already registered with a different instance`)
    }

    this.activityViews[activityView.name] = activityView;
  },

  getActivityViews() {
    return this.activityViews;
  },

  getActivityView(name: string) {
    const activityView = this.activityViews[name];

    if (activityView === undefined) {
      throw new Error(`ActivityView ${name} not found`);
    }

    return activityView;
  }
}