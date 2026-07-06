<script lang="ts">
  import { tick } from "svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import { cn } from "@/utils";

  interface Props {
    /** Current value, controlled by the parent. */
    value: string;
    /** Called with the trimmed new value when the edit is committed and changed. */
    onSave: (value: string) => void | Promise<void>;
    /** Field name/id used by the underlying InputField. */
    name?: string;
    /** Optional label for the underlying InputField (omit for a bare title). */
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    /** Class applied to the read-only text. */
    class?: string;
    /** Class applied to the InputField while editing. */
    inputClass?: string;
  }
  let {
    value,
    onSave,
    name = "editable-text-field",
    label,
    placeholder = "",
    disabled = false,
    class: className = "text-2xl font-semibold",
    inputClass,
  }: Props = $props();

  let editing = $state(false);
  let draft = $state("");
  let wrapperRef = $state<HTMLElement | null>(null);

  async function startEditing() {
    if (disabled) return;
    draft = value;
    editing = true;
    await tick();
    // InputField doesn't expose its input ref, so reach for it via the wrapper.
    const input = wrapperRef?.querySelector("input");
    input?.focus();
    input?.select();
  }

  function commit() {
    if (!editing) return;
    editing = false;
    const next = draft.trim();
    // Ignore empty or unchanged values — revert to the current value.

    if (next && next !== value) {
      onSave(next);
    }
  }

  function cancel() {
    editing = false;
    draft = value;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      // Keep the keypress from bubbling to parent handlers (e.g. Sheet/Dialog).
      event.stopPropagation();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      // Escape should only exit edit mode, not close the surrounding Sheet.
      event.stopPropagation();
      cancel();
    }
  }
</script>

{#if editing}
  <!-- keydown bubbles up from the input, so Enter/Esc are handled here. -->
  <div bind:this={wrapperRef} role="presentation" onkeydown={onKeydown}>
    <InputField
      {name}
      {label}
      {placeholder}
      {disabled}
      class={inputClass}
      value={draft}
      oninput={(e) => (draft = e.currentTarget.value)}
      onblur={commit}
    />
  </div>
{:else}
  <span
    role="button"
    tabindex={disabled ? -1 : 0}
    class={cn("cursor-text", disabled && "cursor-default", className)}
    onclick={startEditing}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startEditing();
      }
    }}
  >
    {value || placeholder}
  </span>
{/if}
