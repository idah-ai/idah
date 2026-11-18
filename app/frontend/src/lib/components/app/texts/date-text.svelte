<script lang="ts">
  import { differenceInCalendarDays, format, formatDistanceToNow, isAfter } from "date-fns";

  import { today as reportingDay } from "@/utils/date";

  import Text from "@/components/ui/text/Text.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import type { TextProps, TextSize } from "@/components/ui/text/Text.svelte";

  // Props
  interface Props {
    // Props::DateText
    datetime: Date | null;
    datetimeFormat: string;
    dateOnly?: boolean;
    showDistance?: boolean;
    showTooltip?: boolean;
    class?: string | null;
    // Props::Text
    size?: TextSize;
    weight?: TextProps["weight"];
  }
  let {
    datetime,
    datetimeFormat,
    dateOnly = false,
    showDistance = false,
    showTooltip = false,
    class: className,
    size = "default",
    weight = "normal",
  }: Props = $props();

  // Variables
  const today: Date = new Date();
  const formattedDate = $derived(formatDate(datetime));
  const formattedDistance = $derived(formatDistance(datetime));
  const formattedValue = $derived(showDistance ? formattedDistance : formattedDate);
  const tooltipValue = $derived(showDistance ? formattedDate : formattedDistance);

  // Functions
  function formatDistance(date: Date | null): string {
    if (!date) return "-";

    if (dateOnly) {
      const days = differenceInCalendarDays(date, $reportingDay);

      switch (days) {
        case 0:
          return "Today";
        case 1:
          return "Tomorrow";
        case -1:
          return "Yesterday";
        default:
          return days > 0 ? `In ${days} days` : `${-days} days ago`;
      }
    }

    const formattedDistance = formatDistanceToNow(date, { includeSeconds: false, addSuffix: true });

    if (isAfter(date, today)) {
      return `Next ${formattedDistance}`;
    } else {
      return formattedDistance;
    }
  }

  function formatDate(date: Date | null): string {
    if (!date) return "-";

    return format(date, datetimeFormat);
  }
</script>

{#if showTooltip}
  <TooltipProvider>
    <Tooltip delayDuration={200}>
      <TooltipTrigger>
        <Text {size} {weight} class={className}>
          {formattedValue}
        </Text>
      </TooltipTrigger>

      <TooltipContent>{tooltipValue}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
{:else}
  <Text {size} {weight} class={className}>
    {formattedValue}
  </Text>
{/if}
