<script lang="ts">
  import { EyeIcon, InfoIcon } from "@lucide/svelte";
  import { untrack } from "svelte";

  import VisibilityGroup from "@/components/app/datasets/labels/properties/visibility/visibility-group.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import Text from "@/components/ui/text/Text.svelte";
  import Textarea from "@/components/ui/textarea/textarea.svelte";

  import {
    canEditInBuilder,
    describeRules,
    hasProblems,
    visibilityFields,
  } from "@/components/app/datasets/labels/properties/visibility/visibility-fields";
  import type { IConfigProperty, IConfigValue } from "@/plugin/v2/types";
  import {
    newGroup,
    rulesFromAst,
    rulesToAst,
    visibilityToText,
    type RuleGroup,
    type Visibility,
  } from "@/utils/visibility_rules";

  import * as parser from "@build/parser.js";

  // Props
  interface Props {
    visibility: Visibility;
    categories: IConfigValue[];
    /** All properties of the label config, including the one being edited. */
    properties: IConfigProperty[];
    propertyId: string;
    onChange: (visibility: Visibility) => void;
  }
  let { visibility, categories, properties, propertyId, onChange }: Props = $props();

  const EXAMPLE = 'category = "vehicles/car" and properties.occluded = true';

  type Mode = "builder" | "expression";
  type Parsed = { visibility: Visibility; error?: undefined } | { visibility?: undefined; error: string };

  // Variables
  let fields = $derived(visibilityFields(categories, properties, propertyId));

  // Set up once from the stored visibility; after that, this editor is the source of changes.
  const initialRules = untrack(() => builderRules(visibility));
  let mode: Mode = $state(initialRules ? "builder" : "expression");
  let rules: RuleGroup = $state.raw(initialRules ?? newGroup("all", []));
  let text: string = $state(untrack(() => visibilityToText(visibility)));

  let parsed: Parsed = $derived(parseText(text));
  let textRules: RuleGroup | null = $derived(parsed.error === undefined ? builderRules(parsed.visibility) : null);
  let rulesIncomplete: boolean = $derived(hasProblems(rules, fields));

  let summary: string | undefined = $derived.by(() => {
    if (mode === "expression" && parsed.error !== undefined) return undefined;
    const shown = mode === "builder" ? rules : textRules;
    if (!shown) return "Visible when the expression matches";
    if (shown.items.length === 0) return "Always visible";
    return `Visible when ${describeRules(shown, fields)}`;
  });

  // Functions
  /** Rules for the builder, or null when the builder can't show this visibility. */
  function builderRules(value: Visibility): RuleGroup | null {
    const group = rulesFromAst(value);
    return group && canEditInBuilder(group, fields) ? group : null;
  }

  function parseText(value: string): Parsed {
    if (!value.trim()) return { visibility: true };
    try {
      return { visibility: parser.parse(value) };
    } catch (error) {
      if (!(error instanceof Error)) return { error: String(error) };
      const start = (error as Error & { location?: { start: { line: number; column: number } } }).location?.start;
      return { error: start ? `Line ${start.line}, column ${start.column}: ${error.message}` : error.message };
    }
  }

  function setRules(next: RuleGroup) {
    rules = next;
    // Incomplete conditions are shown with their problem and saved once fixed.
    if (!hasProblems(next, fields)) onChange(rulesToAst(next));
  }

  function setText(value: string) {
    text = value;
    const result = parseText(value);
    if (result.error === undefined) onChange(result.visibility);
  }

  function switchMode(next: string) {
    if (next === mode) return;
    if (next === "expression" && !rulesIncomplete) {
      text = visibilityToText(rulesToAst(rules));
      mode = "expression";
    } else if (next === "builder" && textRules) {
      rules = textRules;
      mode = "builder";
    }
  }
</script>

<div class="flex flex-col gap-1.5">
  <Tabs bind:value={() => mode, switchMode} class="gap-1.5">
    <!-- VISIBILITY::HEADER -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-1">
        <Text size="sm" class="text-accent-foreground/70">Visibility</Text>
        <Tooltips align="center">
          {#snippet trigger()}
            <InfoIcon class="text-muted-foreground size-4" />
          {/snippet}

          {#snippet content()}
            <div class="max-w-sm">
              <Text size="sm" weight="bold">How to set visibility</Text>
              <p>With no conditions, the property is always shown.</p>
              <br />
              <p>
                Add conditions on the category or on other properties. Use a group to mix "all" and "any", for example:
                occluded is yes, and the category is a vehicle or a pedestrian.
              </p>
              <br />
              <p>
                In the Expression tab, write the same as text:<br />
                <code class="bg-secondary/20 rounded">category = "vehicles/car" and properties.occluded = true</code>
              </p>
            </div>
          {/snippet}
        </Tooltips>
      </div>

      <TabsList class="h-7">
        <TabsTrigger value="builder" class="px-2 text-xs" disabled={mode === "expression" && !textRules}
          >Builder</TabsTrigger
        >
        <TabsTrigger value="expression" class="px-2 text-xs" disabled={mode === "builder" && rulesIncomplete}>
          Expression
        </TabsTrigger>
      </TabsList>
    </div>

    <!-- VISIBILITY::BUILDER -->
    <TabsContent value="builder">
      <VisibilityGroup group={rules} {fields} root onChange={setRules} />
      {#if rulesIncomplete}
        <p class="text-muted-foreground mt-2 text-xs">Changes are saved once every condition is complete.</p>
      {/if}
    </TabsContent>

    <!-- VISIBILITY::EXPRESSION -->
    <TabsContent value="expression" class="flex flex-col gap-1.5">
      <Textarea
        class="min-h-24 font-mono text-xs"
        spellcheck={false}
        aria-label="Visibility expression"
        aria-invalid={parsed.error !== undefined}
        placeholder={EXAMPLE}
        rows={Math.max(3, text.split("\n").length + 1)}
        value={text}
        oninput={(e) => setText(e.currentTarget.value)}
      />
      {#if parsed.error !== undefined}
        <p class="text-destructive text-xs">{parsed.error}</p>
      {:else if !textRules}
        <p class="text-muted-foreground text-xs">The builder can't show this expression. It's saved as written.</p>
      {/if}
    </TabsContent>
  </Tabs>

  <!-- VISIBILITY::SUMMARY -->
  {#if summary}
    <div class="bg-muted text-muted-foreground flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs">
      <EyeIcon class="mt-0.5 size-3.5 shrink-0" />
      <span>{summary}</span>
    </div>
  {/if}
</div>
