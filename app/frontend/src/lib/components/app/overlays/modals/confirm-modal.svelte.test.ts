import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import {
  cancelConfirmModal,
  selectConfirmModalAction,
  settleConfirmModal,
  showConfirmModal,
} from "@/components/app/overlays/modals/confirm-modal.service.svelte";
import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
import { ConfirmModalChoice, confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";

afterEach(() => {
  cancelConfirmModal();
  settleConfirmModal(false);
});

describe("ConfirmModal", () => {
  it("mounts outside a router without throwing", () => {
    expect(() => render(ConfirmModal)).not.toThrow();
  });

  it("renders nothing while idle", () => {
    render(ConfirmModal);

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("renders the active request and resolves on confirm", async () => {
    render(ConfirmModal);

    const choice = showConfirmModal({
      title: "Delete Dataset",
      description: 'Are you sure you want to delete the dataset "Ants"?',
      confirmLabel: "Delete",
    });

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Delete Dataset")).toBeTruthy();
    expect(screen.getByText('Are you sure you want to delete the dataset "Ants"?')).toBeTruthy();

    await screen.findByRole("button", { name: "Delete" });
    void selectConfirmModalAction(ConfirmModalChoice.Confirm);

    await expect(choice).resolves.toBe(ConfirmModalChoice.Confirm);
  });

  it("renders one button per action, plus cancel", async () => {
    render(ConfirmModal);

    void showConfirmModal({
      title: "Unsaved changes",
      actions: [
        { id: "discard", label: "Don't Save", variant: "outline" },
        { id: "save", label: "Save" },
      ],
    });

    await screen.findByRole("alertdialog");

    expect(screen.getByRole("button", { name: "Don't Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("keeps the dialog mounted when run returns KeepOpen", async () => {
    render(ConfirmModal);

    void showConfirmModal({
      title: "Delete Dataset",
      onConfirm: async () => confirmModalResult.KeepOpen,
    });

    await screen.findByRole("alertdialog");
    await selectConfirmModalAction(ConfirmModalChoice.Confirm);

    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  describe("while an action is pending", () => {
    /** Opens a modal whose action hangs until the returned `release` is called. */
    async function openWithPendingAction() {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const choice = showConfirmModal({
        title: "Delete Dataset",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        onConfirm: () => gate,
      });

      await screen.findByRole("alertdialog");
      const dispatched = selectConfirmModalAction(ConfirmModalChoice.Confirm);
      await tick(); // let the pending state reach the DOM

      return { choice, release, dispatched };
    }

    it("disables Cancel, so the dialog cannot be dismissed mid-mutation", async () => {
      render(ConfirmModal);
      const { release, dispatched } = await openWithPendingAction();

      // bits-ui keeps `disabled` internal (it guards its own handlers) and never forwards it
      // to the element, so aria-disabled is what carries the state to the DOM and to AT.
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");

      release();
      await dispatched;
    });

    it("re-enables Cancel once the action settles with KeepOpen", async () => {
      render(ConfirmModal);

      void showConfirmModal({
        title: "Delete Dataset",
        cancelLabel: "Cancel",
        onConfirm: async () => confirmModalResult.KeepOpen,
      });

      await screen.findByRole("alertdialog");
      expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveAttribute("aria-disabled");

      await selectConfirmModalAction(ConfirmModalChoice.Confirm);
      await tick();

      expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveAttribute("aria-disabled");
    });

    it("disables every action button and shows the pending spinner", async () => {
      render(ConfirmModal);

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const choice = showConfirmModal({
        title: "Unsaved changes",
        actions: [
          { id: "discard", label: "Don't Save", variant: "outline" },
          { id: "save", label: "Save", run: () => gate },
        ],
      });

      await screen.findByRole("alertdialog");
      const dispatched = selectConfirmModalAction("save");
      await tick(); // let the pending state reach the DOM

      /**
       * Queried by slot rather than by name: the running button renders Spinner, whose
       * `role="status" aria-label="Loading"` makes its accessible name "Loading Save".
       * Siblings are disabled by the host; the running one disables itself via Button's
       * `loading` prop, which also blocks a double submit.
       */
      const actions = screen.getAllByRole("button").filter((b) => b.dataset.slot === "button");
      expect(actions).toHaveLength(2);
      for (const action of actions) expect(action).toBeDisabled();

      expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();

      release();
      await dispatched;
      await expect(choice).resolves.toBe("save");
    });
  });
});
