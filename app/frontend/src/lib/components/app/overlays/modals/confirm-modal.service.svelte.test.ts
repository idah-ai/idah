import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cancelConfirmModal,
  confirmModalStore,
  isConfirmModalActive,
  selectConfirmModalAction,
  settleConfirmModal,
  showConfirmModal,
} from "@/components/app/overlays/modals/confirm-modal.service.svelte";
import { ConfirmModalChoice, confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";

/**
 * The store is a module singleton, so every test must leave it idle. `cancelConfirmModal`
 * settles a dangling promise; `settleConfirmModal(false)` clears the request the way
 * `onOpenChangeComplete` does in the host.
 */
afterEach(() => {
  cancelConfirmModal();
  settleConfirmModal(false);
});

/** Lets a pending microtask chain (an awaited `run`) finish before asserting. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("showConfirmModal", () => {
  it("opens with a default confirm action", () => {
    void showConfirmModal({ title: "Delete Dataset", description: "Are you sure?" });

    expect(confirmModalStore.open).toBe(true);
    expect(confirmModalStore.request?.title).toBe("Delete Dataset");
    expect(confirmModalStore.request?.actions).toHaveLength(1);
    expect(confirmModalStore.request?.actions[0].id).toBe(ConfirmModalChoice.Confirm);
    expect(confirmModalStore.pendingActionId).toBeNull();
  });

  it("throws when a modal is already active", () => {
    void showConfirmModal({ title: "First" });

    expect(() => showConfirmModal({ title: "Second" })).toThrow(/while "First" is still active/);
  });

  /**
   * Deliberately does NOT call settleConfirmModal() between the two: in the app that only
   * runs from the host's onOpenChangeComplete, i.e. after the exit animation. Calling it by
   * hand here would hide the very lifecycle window this asserts.
   */
  it("allows a second modal as soon as the first resolves, mid exit animation", async () => {
    const first = showConfirmModal({ title: "First" });
    const firstId = confirmModalStore.request?.id;

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await expect(first).resolves.toBe(ConfirmModalChoice.Confirm);

    // Closing, but still mounted for the animation — the previous request lingers.
    expect(confirmModalStore.open).toBe(false);
    expect(confirmModalStore.request).not.toBeNull();

    const second = showConfirmModal({ title: "Second" });
    expect(confirmModalStore.request?.id).not.toBe(firstId);
    expect(confirmModalStore.open).toBe(true);

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await expect(second).resolves.toBe(ConfirmModalChoice.Confirm);
  });

  it("ignores a late settle from the request a new one replaced", async () => {
    const first = showConfirmModal({ title: "First" });
    void selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await first;

    const second = showConfirmModal({ title: "Second" });

    // The first modal's close transition completes after the second has taken over.
    settleConfirmModal(false);

    expect(confirmModalStore.request?.title).toBe("Second");
    expect(confirmModalStore.open).toBe(true);

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await expect(second).resolves.toBe(ConfirmModalChoice.Confirm);
  });
});

describe("sync mode", () => {
  it("closes and resolves the action id on confirm", async () => {
    const choice = showConfirmModal({ title: "Delete Dataset" });

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);

    await expect(choice).resolves.toBe(ConfirmModalChoice.Confirm);
    expect(confirmModalStore.open).toBe(false);
  });

  it("closes and resolves cancel", async () => {
    const choice = showConfirmModal({ title: "Delete Dataset" });

    cancelConfirmModal();

    await expect(choice).resolves.toBe(ConfirmModalChoice.Cancel);
    expect(confirmModalStore.open).toBe(false);
  });

  it("resolves the id of the chosen action in a multi-action modal", async () => {
    const choice = showConfirmModal({
      title: "Unsaved changes",
      actions: [
        { id: "discard", label: "Don't Save", variant: "outline" },
        { id: "save", label: "Save" },
      ],
    });

    void selectConfirmModalAction("save");

    await expect(choice).resolves.toBe("save");
    expect(confirmModalStore.open).toBe(false);
  });
});

describe("async mode", () => {
  it("closes and resolves when run succeeds", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const choice = showConfirmModal({ title: "Delete Dataset", onConfirm: run });

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);

    await expect(choice).resolves.toBe(ConfirmModalChoice.Confirm);
    expect(run).toHaveBeenCalledOnce();
    expect(confirmModalStore.open).toBe(false);
  });

  it("keeps the modal open when run returns KeepOpen", async () => {
    const settled = vi.fn();
    const choice = showConfirmModal({
      title: "Delete Dataset",
      onConfirm: async () => confirmModalResult.KeepOpen,
    });
    void choice.then(settled);

    await selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await flush();

    expect(confirmModalStore.open).toBe(true);
    expect(confirmModalStore.request?.title).toBe("Delete Dataset");
    expect(confirmModalStore.pendingActionId).toBeNull();
    expect(settled).not.toHaveBeenCalled();
  });

  it("keeps the modal open when run throws, and logs it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const settled = vi.fn();
    const choice = showConfirmModal({
      title: "Delete Dataset",
      onConfirm: async () => {
        throw new Error("network down");
      },
    });
    void choice.then(settled);

    await selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await flush();

    expect(confirmModalStore.open).toBe(true);
    expect(confirmModalStore.pendingActionId).toBeNull();
    expect(settled).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledOnce();

    consoleError.mockRestore();
  });

  it("marks the action pending while run is in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const choice = showConfirmModal({ title: "Delete Dataset", onConfirm: () => gate });
    const dispatched = selectConfirmModalAction(ConfirmModalChoice.Confirm);

    expect(confirmModalStore.pendingActionId).toBe(ConfirmModalChoice.Confirm);
    expect(confirmModalStore.open).toBe(true);

    release();
    await dispatched;

    await expect(choice).resolves.toBe(ConfirmModalChoice.Confirm);
    expect(confirmModalStore.pendingActionId).toBeNull();
  });

  it("ignores a second action while one is pending", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const second = vi.fn();

    void showConfirmModal({
      title: "Unsaved changes",
      actions: [
        { id: "save", label: "Save", run: () => gate },
        { id: "discard", label: "Don't Save", run: second },
      ],
    });

    const dispatched = selectConfirmModalAction("save");
    void selectConfirmModalAction("discard");

    expect(second).not.toHaveBeenCalled();

    release();
    await dispatched;
  });

  /**
   * The Cancel button and Escape are both disabled while an action runs, so the only caller
   * left is the host's afterNavigate. A route change must still settle the promise, and the
   * mutation's late result must not resolve it a second time.
   */
  it("survives a route-change cancel mid-action, ignoring the late result", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const choice = showConfirmModal({ title: "Delete Dataset", onConfirm: () => gate });
    const dispatched = selectConfirmModalAction(ConfirmModalChoice.Confirm);

    cancelConfirmModal();
    await expect(choice).resolves.toBe(ConfirmModalChoice.Cancel);

    // The mutation keeps running and settles afterwards; it must not resolve again.
    release();
    await dispatched;
    await flush();

    expect(confirmModalStore.open).toBe(false);
  });

  it("runs only the chosen action in a mixed sync/async modal", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const choice = showConfirmModal({
      title: "Unsaved changes",
      actions: [
        { id: "discard", label: "Don't Save", variant: "outline" },
        { id: "save", label: "Save", run: save },
      ],
    });

    void selectConfirmModalAction("discard");

    await expect(choice).resolves.toBe("discard");
    expect(save).not.toHaveBeenCalled();
    expect(confirmModalStore.open).toBe(false);
  });
});

describe("isConfirmModalActive", () => {
  /**
   * Regression guard for the labels-page navigation guard: the overlay blocks clicks but not
   * the browser's Back button, so `beforeNavigate` can re-enter while its own modal is open.
   * Before this predicate existed it called showConfirmModal() again, which throws.
   */
  it("is false when idle", () => {
    expect(isConfirmModalActive()).toBe(false);
  });

  it("is true while a modal is open", () => {
    void showConfirmModal({ title: "Unsaved changes" });

    expect(isConfirmModalActive()).toBe(true);
  });

  it("is true while an action is pending", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    void showConfirmModal({ title: "Unsaved changes", onConfirm: () => gate });
    const dispatched = selectConfirmModalAction(ConfirmModalChoice.Confirm);

    expect(isConfirmModalActive()).toBe(true);

    release();
    await dispatched;
  });

  it("stays true through the close transition, until settle", async () => {
    const choice = showConfirmModal({ title: "Unsaved changes" });

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await choice;

    // Closing but still mounted for the exit animation: a re-entrant guard must still bail.
    expect(isConfirmModalActive()).toBe(true);

    settleConfirmModal(false);
    expect(isConfirmModalActive()).toBe(false);
  });

  it("lets a re-entrant caller bail instead of throwing", async () => {
    // What the labels-page beforeNavigate guard now does on browser Back.
    const first = showConfirmModal({ title: "Unsaved changes" });

    const reentrantGuard = () => {
      if (isConfirmModalActive()) return "bailed";
      return showConfirmModal({ title: "Unsaved changes" });
    };

    expect(reentrantGuard()).toBe("bailed");
    expect(confirmModalStore.request?.title).toBe("Unsaved changes");

    cancelConfirmModal();
    await expect(first).resolves.toBe(ConfirmModalChoice.Cancel);
  });
});

describe("settleConfirmModal", () => {
  it("clears the request only once the close transition has completed", async () => {
    const choice = showConfirmModal({ title: "Delete Dataset" });

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await choice;

    // Still mounted so the exit animation has something to render.
    expect(confirmModalStore.request).not.toBeNull();

    settleConfirmModal(false);
    expect(confirmModalStore.request).toBeNull();
  });

  it("is a no-op while the modal is opening", () => {
    void showConfirmModal({ title: "Delete Dataset" });

    settleConfirmModal(true);

    expect(confirmModalStore.request).not.toBeNull();
  });
});

describe("cancelConfirmModal", () => {
  it("is idempotent once a request has settled", async () => {
    const choice = showConfirmModal({ title: "Delete Dataset" });

    void selectConfirmModalAction(ConfirmModalChoice.Confirm);
    await expect(choice).resolves.toBe(ConfirmModalChoice.Confirm);

    expect(() => cancelConfirmModal()).not.toThrow();
  });

  it("is a no-op when nothing is active", () => {
    expect(() => cancelConfirmModal()).not.toThrow();
    expect(confirmModalStore.open).toBe(false);
  });
});
