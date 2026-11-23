import {
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

export interface DateRangeValue {
  start: string;
  end: string;
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRangeValue;
}

export const COMPLETION_DATE_PRESETS = [
  "Today",
  "Last 7 days",
  "Last 30 days",
  "Last 90 days",
  "Last 6 months",
  "This week",
  "Last week",
  "This month",
  "Last month",
  "This year",
  "Last year",
] as const;

export function getPresetValue(preset: (typeof COMPLETION_DATE_PRESETS)[number]): DateRangeValue {
  let start = startOfDay(new Date());
  let end = start;

  const week = startOfWeek(end, { weekStartsOn: 1 });

  switch (preset) {
    case "Last 7 days":
      start = subDays(end, 6);
      break;
    case "Last 30 days":
      start = subDays(end, 29);
      break;
    case "Last 90 days":
      start = subDays(end, 89);
      break;
    case "Last 6 months":
      start = subMonths(end, 6);
      break;
    case "This week":
      start = week;
      break;
    case "Last week":
      start = subWeeks(week, 1);
      end = subDays(week, 1);
      break;
    case "This month":
      start = startOfMonth(end);
      break;
    case "Last month":
      start = startOfMonth(subMonths(end, 1));
      end = endOfMonth(start);
      break;
    case "This year":
      start = startOfYear(end);
      end = endOfYear(end);
      break;

    case "Last year":
      start = startOfYear(subYears(end, 1));
      end = endOfYear(start);
      break;
  }

  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}
