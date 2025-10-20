<script lang="ts">
  import { SendHorizontalIcon } from "@lucide/svelte";
  import type { FormEventHandler } from "svelte/elements";

  import MarkdownEditor from "@/components/app/markdown/markdown-editor.svelte";
  import { InputGroupButton } from "@/components/ui/input-group";

  // Props
  interface Props {
    disabled?: boolean;
    placeholder?: string;
    value: string | null;
    onInput?: FormEventHandler<HTMLTextAreaElement> | null | undefined;
    onSubmit: () => Promise<void>;
  }
  let { disabled, placeholder = "Write your comment", value = "", onInput, onSubmit }: Props = $props();
</script>

<MarkdownEditor {disabled} {placeholder} {value} {onInput}>
  {#snippet actions()}
    <InputGroupButton
      aria-label="Send"
      class="ml-auto rounded-full"
      variant="default"
      size="icon-xs"
      disabled={!value?.trim() || disabled}
      onclick={onSubmit}
    >
      <SendHorizontalIcon class="size-3" />
      <span class="sr-only">Send</span>
    </InputGroupButton>
  {/snippet}
</MarkdownEditor>
