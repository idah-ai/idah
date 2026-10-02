<script lang="ts">
  import { getContext, hasContext } from "svelte";

  import ComboboxTriggerValueBadges from "@/components/app/forms/fields/combobox/combobox-trigger-value-badges.svelte";
  import MultipleSelectField from "@/components/app/forms/fields/select/multiple/multiple-select-field.svelte";
  import type { IdahDriverV2 } from "@/plugin/v2/driver";

  import type { Resource } from "@/security/types";

  const resource: Resource = "dataset:note_feeds";

  if (!hasContext("driver")) {
    throw new Error(
      'NoteFeedbackBadge is require "driver" context for display "label" and "description". Please setContext("driver", driver) at the parent component.',
    );
  }

  const driver: IdahDriverV2 = getContext("driver");

  interface Props {
    values: string[];
    onSelected: (selectedValues: string[]) => void;
  }
  let { values, onSelected }: Props = $props();
</script>

<MultipleSelectField
  name="{resource}/feedback"
  label="Feedback"
  placeholder="Select feedbacks"
  choices={Object.entries(driver.feedbackConfig).map(([feedbackItemKey, feedbackItem]) => ({
    label: feedbackItem.label,
    value: feedbackItemKey,
    description: feedbackItem.description ?? undefined,
  }))}
  clearable
  {values}
  onSelected={(selectedChoices) => onSelected(selectedChoices.map((choice) => String(choice.value)))}
>
  {#snippet slotTriggerValues({ selectedChoices })}
    <ComboboxTriggerValueBadges values={selectedChoices.map((choice) => choice.label)} truncateLength={15} />
  {/snippet}
</MultipleSelectField>
