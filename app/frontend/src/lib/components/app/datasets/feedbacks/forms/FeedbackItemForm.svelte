<script lang="ts">
  import { getContext } from "svelte";

  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";
  import * as Field from "@/components/ui/field/index";

  import { getFeedbackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import type { Resource } from "@/security/types";

  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);
  const resource: Resource = "dataset:feedback_config_templates";
</script>

<Field.Set class="p-1">
  <Field.Group>
    <TextareaField
      name="{resource}/value"
      label="Feedback text"
      placeholder="Enter the feedback message reviewers should see..."
      description="Add the feedback message reviewers can use when reviewing this dataset."
      required
      value={controller.formModalData.label}
      oninput={(e) => (controller.formModalData.label = e.currentTarget.value)}
    />

    <TextareaField
      name="{resource}/description"
      label="Description (optional)"
      placeholder="Explain when reviewers should use this feedback..."
      description="Provide context to help reviewers choose the appropriate feedback message."
      value={controller.formModalData.description}
      oninput={(e) => (controller.formModalData.description = e.currentTarget.value)}
    />
  </Field.Group>
</Field.Set>
