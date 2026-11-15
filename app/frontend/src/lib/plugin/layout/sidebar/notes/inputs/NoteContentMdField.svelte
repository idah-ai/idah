<script lang="ts">
  import type { FormEventHandler } from "svelte/elements";

  import FieldLabel from "@/components/ui/field/field-label.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";

  import type { Resource } from "@/security/types";

  interface Props {
    label: string;
    placeholder: string;
    value: string | null;
    oninput: FormEventHandler<HTMLTextAreaElement> | null | undefined;
  }
  let { label, placeholder, value, oninput }: Props = $props();

  const resource: Resource = "dataset:note_feeds";
</script>

<TextareaField name="{resource}/content_md" {placeholder} {value} {oninput}>
  {#snippet slotLabel()}
    <FieldLabel class="text-xs">{label}</FieldLabel>
  {/snippet}
</TextareaField>
