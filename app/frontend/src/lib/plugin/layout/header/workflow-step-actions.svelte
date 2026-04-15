<script lang="ts">
  import { SquareCheckIcon, SquareXIcon } from "@lucide/svelte";
  import DropdownMenus from "$lib/components/app/dropdown-menus/dropdown-menus.svelte";
  import Button from "$lib/components/ui/button/button.svelte";

  import type { IDropdownMenus } from "$lib/components/app/dropdown-menus/types";
  import type { IActivityContext } from "$idah/context/activity-context";

  // Props
  interface Props {
    context: IActivityContext;
    loading: boolean;
    stepConfig?: WorkflowStepConfig;
    onSubmit: (opts: Record<string, any>) => Promise<void>;
  }
  let { context, loading, stepConfig, onSubmit }: Props = $props();

  // Workflow step configuration from manifest
  interface WorkflowStepAction {
    name: string;
    label: string;
    icon?: string;
  }

  interface WorkflowStepConfig {
    name: string;
    label: string;
    description?: string;
    actions?: WorkflowStepAction[];
  }

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
  async function handleActionSubmit(action: WorkflowStepAction, value: boolean) {
    console.log("atooooooooo");

    const opts: Record<string, any> = {
      [action.name]: value,
    };

    await onSubmit(opts);
  }

  // Build dropdown menus from step configuration
  const dropdownMenus = $derived.by(() => {
    if (!stepConfig?.actions || stepConfig.actions.length === 0) {
      return null;
    }

    if (stepConfig.actions.length > 1) {
      // Create dropdown for multiple actions with alternating boolean values
      const menus: IDropdownMenus = {
        actions: {
          items: stepConfig.actions.map((action, index) => ({
            label: action.label,
            icon: getIcon(action.icon),
            action: () => handleActionSubmit(action, index === 0),
          })),
        },
      };
      return menus;
    }

    return null;
  });

  // For single action or simple submit
  const hasSimpleAction = $derived(
    !stepConfig?.actions || stepConfig.actions.length === 0 || stepConfig.actions.length === 1,
  );
</script>

{#if hasSimpleAction}
  <!-- Simple submit button for steps without complex actions -->
  <Button
    {loading}
    loadingLabel="Submitting {getStepLabel(context.workflowStep)}"
    size="sm"
    onclick={() => onSubmit({})}
  >
    Submit {stepConfig?.label || getStepLabel(context.workflowStep)}
  </Button>
{:else if dropdownMenus}
  <!-- Dropdown menu for steps with multiple boolean actions -->
  <DropdownMenus menus={dropdownMenus}>
    {#snippet trigger({ props })}
      <Button
        {...props}
        size="sm"
        {loading}
        loadingLabel="Submitting {stepConfig?.label || getStepLabel(context.workflowStep)}"
      >
        Submit {stepConfig?.label || getStepLabel(context.workflowStep)}
      </Button>
    {/snippet}
  </DropdownMenus>
{:else}
  <!-- Fallback: Simple button -->
  <Button {loading} loadingLabel="Submitting" size="sm" onclick={() => onSubmit({})}>
    Submit {stepConfig?.label || getStepLabel(context.workflowStep)}
  </Button>
{/if}
