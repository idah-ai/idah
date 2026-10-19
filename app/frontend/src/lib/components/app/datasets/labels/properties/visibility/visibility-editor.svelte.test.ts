import { fireEvent, render, screen } from "@testing-library/svelte";
import peggy from "peggy";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";

import VisibilityEditor from "@/components/app/datasets/labels/properties/visibility/visibility-editor.svelte";
import type { ASTNode, IConfigProperty, IConfigValue } from "@/plugin/v2/types";
import grammar from "@/utils/ast_parser.pegjs?raw";
import type { Visibility } from "@/utils/visibility_rules";

// build/parser.js is generated at container start; compile the grammar here instead.
vi.mock("@build/parser.js", async () => {
  const { default: peggyModule } = await import("peggy");
  const { default: source } = await import("@/utils/ast_parser.pegjs?raw");
  return peggyModule.generate(source);
});

const parse = (input: string): ASTNode => peggy.generate(grammar).parse(input);

const categories: IConfigValue[] = [
  { id: "vehicles/car", label: "Car", color: null, text_color: null },
  { id: "pedestrian", label: "Pedestrian", color: null, text_color: null },
];
const properties: IConfigProperty[] = [
  {
    id: "occluded",
    label: "Occluded",
    description: "",
    type: "boolean",
    required: false,
    visibility: true,
    format: {},
  },
  { id: "plate", label: "Plate", description: "", type: "text", required: false, visibility: true, format: {} },
];

function renderEditor(visibility: Visibility) {
  const onChange = vi.fn();
  render(VisibilityEditor, { visibility, categories, properties, propertyId: "plate", onChange });
  return onChange;
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("VisibilityEditor", () => {
  it("opens a stored rule in the builder, with a summary", () => {
    renderEditor(parse('(properties.occluded = true) and (category in ["pedestrian"])'));

    expect(tab("Builder")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Visible when Occluded is yes and Category is one of Pedestrian")).toBeInTheDocument();
  });

  it("starts empty when there is no condition, and saves an added condition", async () => {
    const onChange = renderEditor(true);

    expect(screen.getByText("No conditions. This property is always shown.")).toBeInTheDocument();
    expect(screen.getByText("Always visible")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Condition" }));

    expect(onChange).toHaveBeenLastCalledWith(parse('category = "vehicles/car"'));
  });

  it("saves true when the last condition is removed", async () => {
    const onChange = renderEditor(parse('category = "pedestrian"'));

    await fireEvent.click(screen.getByRole("button", { name: "Remove condition" }));

    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("opens rules the builder can't show in the expression tab", () => {
    renderEditor(parse("properties.occluded = properties.plate"));

    expect(tab("Expression")).toHaveAttribute("aria-selected", "true");
    expect(tab("Builder")).toBeDisabled();
    expect(screen.getByLabelText("Visibility expression")).toHaveValue("properties.occluded = properties.plate");
    expect(screen.getByText("The builder can't show this expression. It's saved as written.")).toBeInTheDocument();
  });

  it("saves valid expressions and reports invalid ones without saving", async () => {
    const onChange = renderEditor(parse('category = "pedestrian"'));

    await fireEvent.click(tab("Expression"));
    const textarea = screen.getByLabelText("Visibility expression");
    expect(textarea).toHaveValue('category = "pedestrian"');

    await fireEvent.input(textarea, { target: { value: "category = " } });
    expect(screen.getByText(/^Line 1, column 12:/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.input(textarea, { target: { value: "properties.occluded = false" } });
    expect(onChange).toHaveBeenLastCalledWith(parse("properties.occluded = false"));

    await fireEvent.click(tab("Builder"));
    await tick();
    expect(screen.getByText("Visible when Occluded is no")).toBeInTheDocument();
  });

  it("holds back incomplete conditions and keeps them in the builder", () => {
    const onChange = renderEditor(["in", [["get", ["category"]], [[]]]] as unknown as ASTNode);

    expect(screen.getByText("Choose at least one option")).toBeInTheDocument();
    expect(screen.getByText("Changes are saved once every condition is complete.")).toBeInTheDocument();
    expect(tab("Expression")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
