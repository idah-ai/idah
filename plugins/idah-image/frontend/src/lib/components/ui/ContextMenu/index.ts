import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

import Trigger from "./ContextMenuTrigger.svelte";
import Group from "./ContextMenuGroup.svelte";
import RadioGroup from "./ContextMenuRadioGroup.svelte";
import Item from "./ContextMenuItem.svelte";
import GroupHeading from "./ContextMenuGroupHeading.svelte";
import Content from "./ContextMenuContent.svelte";
import Shortcut from "./ContextMenuShortcut.svelte";
import RadioItem from "./ContextMenuRadioItem.svelte";
import Separator from "./ContextMenuSeparator.svelte";
import SubContent from "./ContextMenuSubContent.svelte";
import SubTrigger from "./ContextMenuSubTrigger.svelte";
import CheckboxItem from "./ContextMenuCheckboxItem.svelte";
import Label from "./ContextMenuLabel.svelte";
const Sub = ContextMenuPrimitive.Sub;
const Root = ContextMenuPrimitive.Root;

export {
	Sub,
	Root,
	Item,
	GroupHeading,
	Label,
	Group,
	Trigger,
	Content,
	Shortcut,
	Separator,
	RadioItem,
	SubContent,
	SubTrigger,
	RadioGroup,
	CheckboxItem,
	//
	Root as ContextMenu,
	Sub as ContextMenuSub,
	Item as ContextMenuItem,
	GroupHeading as ContextMenuGroupHeading,
	Group as ContextMenuGroup,
	Content as ContextMenuContent,
	Trigger as ContextMenuTrigger,
	Shortcut as ContextMenuShortcut,
	RadioItem as ContextMenuRadioItem,
	Separator as ContextMenuSeparator,
	RadioGroup as ContextMenuRadioGroup,
	SubContent as ContextMenuSubContent,
	SubTrigger as ContextMenuSubTrigger,
	CheckboxItem as ContextMenuCheckboxItem,
	Label as ContextMenuLabel,
};
