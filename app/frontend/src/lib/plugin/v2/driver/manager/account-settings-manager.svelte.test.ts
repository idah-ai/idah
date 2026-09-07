import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, upsert } = vi.hoisted(() => ({ list: vi.fn(), upsert: vi.fn() }));

vi.mock("@/data/model/setting/account_setting/record", () => ({
  commandShortcutKey: "command:shortcut",
  accountSettingBackendDataSource: { list, upsert },
}));

import { AccountSettingsManager } from "./account-settings-manager.svelte";

describe("AccountSettingsManager", () => {
  beforeEach(() => {
    list.mockReset();
    upsert.mockReset();
  });

  it("persists settings in its constructor-provided plugin namespace", async () => {
    upsert.mockResolvedValue({ data: { id: "setting-1", value: true } });
    const settings = new AccountSettingsManager("idah-video");

    await settings.upsert("show-timeline", true);

    expect(upsert).toHaveBeenCalledWith("show-timeline", true, "idah-video");
  });

  it("keeps settings isolated between modalities", async () => {
    upsert.mockImplementation(async (_key: string, value: unknown) => ({ data: { id: "setting-1", value } }));
    const videoSettings = new AccountSettingsManager("idah-video");
    const imageSettings = new AccountSettingsManager("idah-image");

    await videoSettings.upsert("show-timeline", true);

    expect(videoSettings.get<boolean>("show-timeline")).toBe(true);
    expect(imageSettings.get<boolean>("show-timeline")).toBeUndefined();
  });

  it("round-trips nested JSONB values through a typed read", async () => {
    const preferences = { fontSize: 14, sections: [{ name: "editor", visible: true }] };
    upsert.mockResolvedValue({ data: { id: "setting-1", value: preferences } });
    const settings = new AccountSettingsManager("idah-video");

    await settings.upsert("preferences", preferences);

    expect(settings.get<typeof preferences>("preferences")).toEqual(preferences);
  });

  it("persists shortcut overrides in its plugin namespace", async () => {
    upsert.mockImplementation(async (_key: string, value: unknown) => ({ data: { id: "setting-1", value } }));
    const settings = new AccountSettingsManager("idah-video");

    await settings.setShortcut("timeline.play", "K");
    await settings.resetShortcut("timeline.play");
    await settings.resetAll();

    expect(upsert).toHaveBeenNthCalledWith(1, "command:shortcut", { "timeline.play": "K" }, "idah-video");
    expect(upsert).toHaveBeenNthCalledWith(2, "command:shortcut", {}, "idah-video");
    expect(upsert).toHaveBeenNthCalledWith(3, "command:shortcut", {}, "idah-video");
  });

  it("hydrates only the active modality's shortcuts into the stable override map", async () => {
    list.mockResolvedValue({
      data: [
        { id: "video", key: "command:shortcut", plugin: "idah-video", value: { "timeline.play": "K" } },
        { id: "image", key: "command:shortcut", plugin: "idah-image", value: { "canvas.zoom": "Z" } },
      ],
    });
    const settings = new AccountSettingsManager("idah-video");
    const overrides = settings.getShortcutOverrides();

    await settings.load("account-1");

    expect(settings.getShortcutOverrides()).toBe(overrides);
    expect(overrides).toEqual({ "timeline.play": "K" });
    expect(settings.get<Record<string, string>>("command:shortcut")).toEqual({ "timeline.play": "K" });
  });
});
