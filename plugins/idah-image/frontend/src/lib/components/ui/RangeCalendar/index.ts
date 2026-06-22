import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";
import Root from "./RangeCalendar.svelte";
import Cell from "./RangeCalendarCell.svelte";
import Day from "./RangeCalendarDay.svelte";
import Grid from "./RangeCalendarGrid.svelte";
import Header from "./RangeCalendarHeader.svelte";
import Months from "./RangeCalendarMonths.svelte";
import GridRow from "./RangeCalendarGridRow.svelte";
import Heading from "./RangeCalendarHeading.svelte";
import HeadCell from "./RangeCalendarHeadCell.svelte";
import NextButton from "./RangeCalendarNextButton.svelte";
import PrevButton from "./RangeCalendarPrevButton.svelte";
import MonthSelect from "./RangeCalendarMonthSelect.svelte";
import YearSelect from "./RangeCalendarYearSelect.svelte";
import Caption from "./RangeCalendarCaption.svelte";
import Nav from "./RangeCalendarNav.svelte";
import Month from "./RangeCalendarMonth.svelte";

const GridHead = RangeCalendarPrimitive.GridHead;
const GridBody = RangeCalendarPrimitive.GridBody;

export {
	Day,
	Cell,
	Grid,
	Header,
	Months,
	GridRow,
	Heading,
	GridBody,
	GridHead,
	HeadCell,
	NextButton,
	PrevButton,
	MonthSelect,
	YearSelect,
	Caption,
	Nav,
	Month,
	//
	Root as RangeCalendar,
};
