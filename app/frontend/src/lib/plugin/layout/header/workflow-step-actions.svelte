<script lang="ts">
  import { SquareCheckIcon, SquareXIcon } from "@lucide/svelte";
  import DropdownMenus from "$lib/components/app/dropdown-menus/dropdown-menus.svelte";
  import Button from "$lib/components/ui/button/button.svelte";

  import type { IDropdownMenus } from "$lib/components/app/dropdown-menus/types";

  import type { WorkflowStepActionChoice, WorkflowStepConfig } from "./workflow-step-types";

  // Props
  let { workflowStep, loading, stepConfig, onSubmit }: Props = $props();

  interface Props {
    workflowStep: string;
    loading: boolean;
    stepConfig?: WorkflowStepConfig;
    onSubmit: (opts: Record<string, boolean>) => Promise<void>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iconMap: Record<string, any> = {
    SquareCheckIcon,
    SquareXIcon,
  };

  function getIcon(iconName?: string) {
    return iconName && iconMap[iconName] ? iconMap[iconName] : SquareCheckIcon;
  }

  function getStepLabel(step: string): string {
    return step
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Handle submit with action data
  async function handleChoiceSubmit(key: string, value: boolean) {
    const opts: Record<string, boolean> = {
      [key]: value,
    };

    await onSubmit(opts);
  }

  // Build dropdown menus from step configuration
  const dropdownMenus = $derived.by(() => {
    if (!stepConfig?.actions || stepConfig.actions.length === 0) {
      return null;
    }

    // Flatten all choices from all actions into dropdown items
    const items = stepConfig.actions.flatMap((action) =>
      action.choices.map((choice: WorkflowStepActionChoice) => ({
        label: choice.label,
        icon: getIcon(choice.icon),
        action: () => handleChoiceSubmit(action.name, choice.value),
      })),
    );

    if (items.length === 0) {
      return null;
    }

    // Only show dropdown if there are multiple choices across all actions
    if (items.length > 1) {
      const menus: IDropdownMenus = {
        actions: {
          items,
        },
      };
      return menus;
    }

    return null;
  });

  // For single choice or simple submit
  const hasSimpleAction = $derived(
    !stepConfig?.actions ||
      stepConfig.actions.length === 0 ||
      (stepConfig.actions.length === 1 && stepConfig.actions[0].choices.length <= 1),
  );

  // Get the single action key/value for simple action submit
  const simpleActionKey = $derived(stepConfig?.actions?.[0]?.name);

  const simpleActionValue = $derived(stepConfig?.actions?.[0]?.choices?.[0]?.value ?? false);
</script>

{#if hasSimpleAction}
  <!-- Simple submit button for steps without complex actions -->
  <Button
    {loading}
    loadingLabel="Submitting {getStepLabel(workflowStep)}"
    size="sm"
    onclick={() => {
      if (simpleActionKey) {
        onSubmit({ [simpleActionKey]: simpleActionValue });
      } else {
        onSubmit({});
      }
    }}
  >
    Submit {stepConfig?.label || getStepLabel(workflowStep)}
  </Button>
{:else if dropdownMenus}
  <!-- Dropdown menu for steps with multiple choices -->
  <DropdownMenus menus={dropdownMenus}>
    {#snippet trigger({ props })}
      <Button
        {...props}
        size="sm"
        {loading}
        loadingLabel="Submitting {stepConfig?.label || getStepLabel(workflowStep)}"
      >
        Submit {stepConfig?.label || getStepLabel(workflowStep)}
      </Button>
    {/snippet}
  </DropdownMenus>
{:else}
  <!-- Fallback: Simple button -->
  <Button {loading} loadingLabel="Submitting" size="sm" onclick={() => onSubmit({})}>
    Submit {stepConfig?.label || getStepLabel(workflowStep)}
  </Button>
{/if}
