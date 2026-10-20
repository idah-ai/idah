import { beforeEach, describe, expect, it, vi } from "vitest";

import { LabelConfigController } from "@/components/app/datasets/labels/label-config-controller.svelte";
import { showToast } from "@/components/ui/toast/index.svelte";
import type { IConfigProperty } from "@/plugin/v2/types";

vi.mock("@/components/ui/toast/index.svelte", () => ({ showToast: { error: vi.fn() } }));

const property = (id: string, label: string, extra: Partial<IConfigProperty> = {}): IConfigProperty => ({
  id,
  label,
  type: "text",
  description: "",
  required: false,
  format: {},
  visibility: true,
  ...extra,
});

function controllerWith(...properties: IConfigProperty[]) {
  const controller = new LabelConfigController();
  controller.load({ "idah-video:bounding-box": { values: [], properties } });
  return controller;
}

const propertiesOf = (controller: LabelConfigController) =>
  controller.labelConfig["idah-video:bounding-box"].properties.map((p) => [p.id, p.label, p.type]);

describe("LabelConfigController properties", () => {
  beforeEach(() => {
    vi.mocked(showToast.error).mockClear();
  });

  it("adds a property", () => {
    const controller = controllerWith(property("occluded", "Occluded"));
    controller.addProperty(property("property-1", "New Property"));

    expect(propertiesOf(controller)).toEqual([
      ["occluded", "Occluded", "text"],
      ["property-1", "New Property", "text"],
    ]);
  });

  it("derives the id from the name when a property is renamed", () => {
    const controller = controllerWith(property("property-1", "New Property"));

    expect(controller.setProperty(property("property-1", "Occlusion level"))).toBe(true);
    expect(propertiesOf(controller)).toEqual([["occlusion-level", "Occlusion level", "text"]]);
  });

  it("keeps the generated id while a property is still unnamed", () => {
    const controller = controllerWith(property("property-1", "New Property"), property("property-2", "New Property"));

    controller.setProperty(property("property-2", "New Property", { type: "boolean" }));

    expect(propertiesOf(controller)).toEqual([
      ["property-1", "New Property", "text"],
      ["property-2", "New Property", "boolean"],
    ]);
  });

  it.each([
    ["the same name", "Occluded"],
    ["a name that gives the same id", "occluded"],
  ])("rejects a rename to %s as another property, with an error", (_, name) => {
    const controller = controllerWith(property("occluded", "Occluded"), property("property-1", "New Property"));

    expect(controller.setProperty(property("property-1", name))).toBe(false);
    expect(propertiesOf(controller)).toEqual([
      ["occluded", "Occluded", "text"],
      ["property-1", "New Property", "text"],
    ]);
    expect(showToast.error).toHaveBeenCalledWith({
      title: "Duplicate property",
      description: `A property named "${name}" already exists.`,
    });
  });

  it("rejects an empty name", () => {
    const controller = controllerWith(property("occluded", "Occluded"));

    expect(controller.setProperty(property("occluded", "  "))).toBe(false);
    expect(propertiesOf(controller)).toEqual([["occluded", "Occluded", "text"]]);
    expect(showToast.error).toHaveBeenCalledWith({ title: "Property name required", description: "Enter a name." });
  });

  it("allows saving a property under its own name", () => {
    const controller = controllerWith(property("occluded", "Occluded"));

    expect(controller.setProperty(property("occluded", "Occluded", { required: true }))).toBe(true);
    expect(controller.labelConfig["idah-video:bounding-box"].properties[0].required).toBe(true);
    expect(showToast.error).not.toHaveBeenCalled();
  });

  it("keeps the id on edits that don't rename, even when it isn't the slug of the name", () => {
    // Older configs can hold names whose slugs collide; they must stay editable.
    const controller = controllerWith(property("color", "Color"), property("color-1", "color "));

    expect(controller.setProperty(property("color-1", "color ", { required: true }))).toBe(true);
    expect(propertiesOf(controller)).toEqual([
      ["color", "Color", "text"],
      ["color-1", "color ", "text"],
    ]);
    expect(showToast.error).not.toHaveBeenCalled();
  });

  it("ignores an update for a property id that no longer exists, instead of adding a copy", () => {
    // A card re-rendered under a new id can still send an update for its old id.
    const controller = controllerWith(property("occluded", "Occluded"));

    expect(controller.setProperty(property("property-1", "Occluded", { type: "boolean" }))).toBe(false);
    expect(propertiesOf(controller)).toEqual([["occluded", "Occluded", "text"]]);
  });

  it("does not change the property object it was given", () => {
    const controller = controllerWith(property("property-1", "New Property"));
    const update = property("property-1", "Occluded");

    controller.setProperty(update);

    expect(update.id).toBe("property-1");
  });
});
