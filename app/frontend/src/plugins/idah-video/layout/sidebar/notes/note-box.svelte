<script lang="ts">
  import { SendHorizontalIcon } from "@lucide/svelte";
  import type { FormEventHandler } from "svelte/elements";

  import MarkdownEditor from "@/components/app/markdown/markdown-editor.svelte";
  import { InputGroupButton } from "@/components/ui/input-group";

  // Props
  interface Props {
    value: string | null;
    disabled?: boolean;
    onInput?: FormEventHandler<HTMLTextAreaElement> | null | undefined;
    onSubmit: () => Promise<void>;
  }
  let { value = "", disabled, onInput, onSubmit }: Props = $props();
</script>

<MarkdownEditor {disabled} placeholder="Write your comment" {value} {onInput}>
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
