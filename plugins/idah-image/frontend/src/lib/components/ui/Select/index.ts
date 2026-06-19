import { Select as SelectPrimitive } from "bits-ui";

import Group from "./SelectGroup.svelte";
import Label from "./SelectLabel.svelte";
import Item from "./SelectItem.svelte";
import Content from "./SelectContent.svelte";
import Trigger from "./SelectTrigger.svelte";
import Separator from "./SelectSeparator.svelte";
import ScrollDownButton from "./SelectScrollDownButton.svelte";
import ScrollUpButton from "./SelectScrollUpButton.svelte";
import GroupHeading from "./SelectGroupHeading.svelte";

const Root = SelectPrimitive.Root;

export {
	Root,
	Group,
	Label,
	Item,
	Content,
	Trigger,
	Separator,
	ScrollDownButton,
	ScrollUpButton,
	GroupHeading,
	//
	Root as Select,
	Group as SelectGroup,
	Label as SelectLabel,
	Item as SelectItem,
	Content as SelectContent,
	Trigger as SelectTrigger,
	Separator as SelectSeparator,
	ScrollDownButton as SelectScrollDownButton,
	ScrollUpButton as SelectScrollUpButton,
	GroupHeading as SelectGroupHeading,
};
