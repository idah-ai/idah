<script lang="ts">
  import { XIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Input from "@/components/ui/input/input.svelte";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

  import {
    applyField,
    applyOperator,
    builderOperator,
    conditionProblem,
    conditionReferenceProblems,
    fieldFor,
    operatorsFor,
    selectableFields,
    valueLabel,
    type BuilderOperator,
    type FieldOption,
    type VisibilityField,
    usesOptions,
  } from "@/components/app/datasets/labels/properties/visibility/visibility-fields";
  import { isListOperator, type RuleCondition, type RuleValue } from "@/utils/visibility_rules";

  // Props
  interface Props {
    condition: RuleCondition;
    fields: VisibilityField[];
    onChange: (condition: RuleCondition) => void;
    onRemove: () => void;
  }
  let { condition, fields, onChange, onRemove }: Props = $props();

  // Compact controls: the properties column is narrow.
  const control = "data-[size=sm]:h-7 w-full min-w-0 gap-1 px-2 text-xs";

  // Variables
  let field = $derived(fieldFor(fields, condition));
  let operator = $derived(builderOperator(condition, field));
  let problem = $derived(conditionProblem(condition, field));
  let referenceProblems = $derived(conditionReferenceProblems(condition, field));

  // A field or value that is no longer in the label config stays listed, so the condition still shows it.
  let fieldChoices = $derived(
    selectableFields(fields).includes(field) ? selectableFields(fields) : [field, ...selectableFields(fields)],
  );
  let operatorChoices = $derived(operatorsFor(field));
  let valueChoices = $derived(withMissing(field.options, condition.value));
  let parentValue = $derived(String(condition.value).slice(0, -2));
  let parentChoices = $derived(withMissing(field.parents, parentValue));

  // Functions
  function withMissing(options: FieldOption[], value: RuleValue): FieldOption[] {
    const values = (Array.isArray(value) ? value : [value]).map(String);
    const missing = values
      .filter((v) => v !== "" && !options.some((option) => option.value === v))
      .map((v) => ({ value: v, label: `${v} (not found)` }));
    return [...options, ...missing];
  }

  function setField(path: string) {
    const next = fields.find((f) => f.path === path);
    if (next && next !== field) onChange(applyField(condition, next));
  }

  function setOperator(value: string) {
    if (value !== operator) onChange(applyOperator(condition, value as BuilderOperator, field));
  }

  function setValue(value: RuleValue) {
    onChange({ ...condition, value });
  }
</script>

{#snippet optionItem(choice: FieldOption)}
  <SelectItem
    value={choice.value}
    label={choice.label}
    title={choice.hint ? `${choice.hint} / ${choice.label}` : undefined}
  >
    <div class="flex min-w-0 flex-col">
      <span class="truncate">{choice.label}</span>
      {#if choice.hint}
        <span class="text-muted-foreground truncate text-xs">{choice.hint}</span>
      {/if}
    </div>
  </SelectItem>
{/snippet}

{#snippet singleSelect(
  value: string,
  choices: FieldOption[],
  label: string,
  ariaLabel: string,
  onSelect: (v: string) => void,
)}
  <Select type="single" {value} onValueChange={onSelect}>
    <SelectTrigger
      size="sm"
      class={control}
      aria-label={ariaLabel}
      aria-invalid={!!(problem || referenceProblems.value)}
    >
      <span class="truncate">{label}</span>
    </SelectTrigger>
    <SelectContent class="max-w-80">
      {#each choices as choice (choice.value)}
        {@render optionItem(choice)}
      {/each}
    </SelectContent>
  </Select>
{/snippet}

<div class="flex min-w-0 flex-col gap-0.5">
  <!-- The operator only takes the width of its label; field and value share the rest. -->
  <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-start gap-1">
    <!-- CONDITION::FIELD -->
    <Select type="single" value={field.path} onValueChange={setField}>
      <SelectTrigger size="sm" class={control} aria-label="Field" aria-invalid={!!referenceProblems.field}>
        <span class="truncate">{field.label}</span>
      </SelectTrigger>
      <SelectContent>
        {#each fieldChoices as choice (choice.path)}
          <SelectItem value={choice.path} label={choice.label} />
        {/each}
      </SelectContent>
    </Select>

    <!-- CONDITION::OPERATOR -->
    <Select type="single" value={operator} onValueChange={setOperator}>
      <SelectTrigger size="sm" class="gap-1 px-2 text-xs data-[size=sm]:h-7" aria-label="Operator">
        <span class="truncate">{operatorChoices.find((o) => o.value === operator)?.label ?? operator}</span>
      </SelectTrigger>
      <SelectContent>
        {#each operatorChoices as choice (choice.value)}
          <SelectItem value={choice.value} label={choice.label} />
        {/each}
      </SelectContent>
    </Select>

    <!-- CONDITION::VALUE -->
    {#if isListOperator(operator)}
      <Select type="multiple" value={(condition.value as string[]) ?? []} onValueChange={(values) => setValue(values)}>
        <SelectTrigger
          size="sm"
          class={control}
          aria-label="Values"
          aria-invalid={!!(problem || referenceProblems.value)}
        >
          <span class="truncate">
            {#if Array.isArray(condition.value) && condition.value.length > 0}
              {valueLabel(condition, field)}
            {:else}
              <span class="text-muted-foreground">Choose options</span>
            {/if}
          </span>
        </SelectTrigger>
        <SelectContent class="max-w-80">
          {#each valueChoices as choice (choice.value)}
            {@render optionItem(choice)}
          {/each}
        </SelectContent>
      </Select>
    {:else if operator === "under"}
      {@render singleSelect(parentValue, parentChoices, valueLabel(condition, field), "Parent category", (v) =>
        setValue(`${v}/*`),
      )}
    {:else if field.kind === "boolean"}
      {@render singleSelect(
        String(condition.value),
        [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ],
        condition.value ? "Yes" : "No",
        "Value",
        (v) => setValue(v === "true"),
      )}
    {:else if usesOptions(field, operator)}
      {@render singleSelect(
        String(condition.value),
        valueChoices,
        condition.value === "" ? "Choose a value" : valueLabel(condition, field),
        "Value",
        (v) => setValue(v),
      )}
    {:else if field.kind === "integer"}
      <Input
        type="number"
        step="1"
        class="h-7 px-2 text-xs"
        aria-label="Value"
        aria-invalid={!!(problem || referenceProblems.value)}
        value={condition.value}
        oninput={(e) => setValue(e.currentTarget.valueAsNumber)}
      />
    {:else}
      <Input
        class="h-7 px-2 text-xs"
        aria-label="Value"
        aria-invalid={!!(problem || referenceProblems.value)}
        placeholder={operator !== "match" ? "Value" : field.kind === "category" ? "e.g. vehicles/c*" : "e.g. AB-*"}
        value={condition.value}
        oninput={(e) => setValue(e.currentTarget.value)}
      />
    {/if}

    <!-- CONDITION::REMOVE -->
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-muted-foreground"
      aria-label="Remove condition"
      onclick={onRemove}
    >
      <XIcon />
    </Button>
  </div>

  {#if problem}
    <p class="text-destructive text-xs">{problem}</p>
  {:else if referenceProblems.field}
    <p class="text-destructive text-xs">{referenceProblems.field}</p>
  {:else if referenceProblems.value}
    <p class="text-destructive text-xs">{referenceProblems.value}</p>
  {/if}
</div>
