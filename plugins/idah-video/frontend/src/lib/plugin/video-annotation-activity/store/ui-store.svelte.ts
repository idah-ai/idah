export class UIStore {
  isCommandDialogOpen = $state(false);

  toggleCommandDialog = () => {
    this.isCommandDialogOpen = !this.isCommandDialogOpen;
  };
}

export const uiStore = new UIStore();
