<script lang="ts">
  import Form from "@/components/app/forms/form.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import MultipleSelectFeedbacksField from "@/plugin/layout/sidebar/notes/inputs/MultipleSelectFeedbacksField.svelte";
  import NoteContentMdField from "@/plugin/layout/sidebar/notes/inputs/NoteContentMdField.svelte";

  import { cn } from "@/utils";

  interface Props {
    class?: string | null;

    // Feedback field
    showFeedbackField?: boolean;
    feedbackValues: string[];
    onFeedbackSelected: (selected: string[]) => void;

    // Content field
    contentValue: string | null;
    onContentChange: (newValue: string) => void;
    contentLabel?: string;
    contentPlaceholder?: string;

    // Cancel button
    showCancel?: boolean;
    onCancel?: () => void;

    // Submit button
    onSubmit: () => Promise<void> | void;
    submitLabel?: string;
    loading?: boolean;
    loadingLabel?: string;

    // Additational disabled condition (e.g. permission check)
    disabled?: boolean;
  }

  let {
    class: className,

    // Feedback field
    showFeedbackField = true,
    feedbackValues,
    onFeedbackSelected,

    // Content field
    contentValue,
    onContentChange,
    contentLabel = "Comment",
    contentPlaceholder = "Leave a comment here (optional)",

    // Cancel button
    showCancel = false,
    onCancel,

    // Submit
    onSubmit,
    submitLabel = "Save",
    loading = false,
    loadingLabel = "Saving...",

    disabled: externalDisabled = false,
  }: Props = $props();

  // Internal state for reactive disabled computation
  let internalFeedbackValues = $state<string[]>(feedbackValues);
  let internalContentValue = $state<string | null>(contentValue);
  let internalDisabled = $derived(!internalContentValue?.trim() && internalFeedbackValues.length === 0);
  let submitDisabled = $derived(externalDisabled || internalDisabled);

  function handleFeedbackSelected(selected: string[]) {
    internalFeedbackValues = selected;
    onFeedbackSelected(selected);
  }

  function handleContentChange(newValue: string) {
    internalContentValue = newValue;
    onContentChange(newValue);
  }
</script>

<Form class={cn("gap-2", className)}>
  {#if showFeedbackField}
    <MultipleSelectFeedbacksField values={internalFeedbackValues} onSelected={handleFeedbackSelected} />
  {/if}

  <NoteContentMdField
    label={contentLabel}
    placeholder={contentPlaceholder}
    value={contentValue}
    oninput={(e) => handleContentChange(e.currentTarget.value)}
  />

  <div class="flex w-full items-center justify-end gap-2">
    {#if showCancel}
      <Button
        variant="outline"
        size="sm"
        onclick={(e) => {
          e.stopPropagation();
          onCancel?.();
        }}
      >
        Cancel
      </Button>
    {/if}

    <Button
      size="sm"
      disabled={submitDisabled}
      {loading}
      {loadingLabel}
      onclick={async (e) => {
        e.stopPropagation();
        if (submitDisabled) return;
        await onSubmit();
      }}
    >
      {submitLabel}
    </Button>
  </div>
</Form>
