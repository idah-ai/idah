<script lang="ts">
  import type { Snippet } from "svelte";
  import type { FormEventHandler } from "svelte/elements";

  import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";

  // Props
  interface Props {
    disabled?: boolean;
    placeholder?: string;
    value: string | null;
    onInput?: FormEventHandler<HTMLTextAreaElement> | null | undefined;
    actions?: Snippet;
  }
  let { disabled, placeholder = "Write your markdown here...", value, onInput, actions }: Props = $props();
</script>

<InputGroup class="bg-background">
  <InputGroupTextarea {placeholder} {disabled} {value} oninput={onInput} />

  <InputGroupAddon align="block-end">
    {@render actions?.()}
  </InputGroupAddon>
</InputGroup>
