<script lang="ts">
  import { SendHorizontalIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import type { FormEventHandler } from "svelte/elements";

  import MarkdownEditor from "@/components/app/markdown/markdown-editor.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import { InputGroupButton } from "@/components/ui/input-group";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";

  // Props
  interface Props {
    disabled?: boolean;
    placeholder?: string;
    value: string | null;
    onInput?: FormEventHandler<HTMLTextAreaElement> | null | undefined;
    onSubmit: () => Promise<void>;
  }
  let { disabled, placeholder = "Write your note", value = "", onInput, onSubmit }: Props = $props();

  // Functions
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

<MarkdownEditor {disabled} {placeholder} {value} {onInput}>
  {#snippet actions()}
    <Tooltips class="ml-auto" align="center">
      {#snippet trigger()}
        <InputGroupButton
          aria-label="Send"
          class="rounded-full"
          variant="default"
          size="icon-xs"
          disabled={!value?.trim() || disabled}
          onclick={onSubmit}
        >
          <SendHorizontalIcon class="size-3" />
          <span class="sr-only"> Send </span>
        </InputGroupButton>
      {/snippet}

      {#snippet content()}
        <div class="flex items-center gap-2">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
          </KbdGroup>

          <span>to submit</span>
        </div>
      {/snippet}
    </Tooltips>
  {/snippet}
</MarkdownEditor>
