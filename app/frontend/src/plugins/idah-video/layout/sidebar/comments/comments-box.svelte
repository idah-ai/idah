<script lang="ts">
  import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
  import { SendHorizontalIcon } from "@lucide/svelte";
  import type { FormEventHandler } from "svelte/elements";

  // Props
  interface Props {
    value: string | null;
    disabled?: boolean;
    onInput?: FormEventHandler<HTMLTextAreaElement> | null | undefined;
    onSubmit: () => Promise<void>;
  }
  let { value, disabled, onInput, onSubmit }: Props = $props();
</script>

<InputGroup>
  <InputGroupTextarea autofocus placeholder="Enter your comment" {disabled} {value} oninput={onInput} />
  <InputGroupAddon align="block-end">
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
  </InputGroupAddon>
</InputGroup>
