import { Command as CommandPrimitive } from "bits-ui";

import Root from "./Command.svelte";
import Dialog from "./CommandDialog.svelte";
import Empty from "./CommandEmpty.svelte";
import Group from "./CommandGroup.svelte";
import Item from "./CommandItem.svelte";
import Input from "./CommandInput.svelte";
import List from "./CommandList.svelte";
import Separator from "./CommandSeparator.svelte";
import Shortcut from "./CommandShortcut.svelte";
import LinkItem from "./CommandLinkItem.svelte";

const Loading = CommandPrimitive.Loading;

export {
	Root,
	Dialog,
	Empty,
	Group,
	Item,
	LinkItem,
	Input,
	List,
	Separator,
	Shortcut,
	Loading,
	//
	Root as Command,
	Dialog as CommandDialog,
	Empty as CommandEmpty,
	Group as CommandGroup,
	Item as CommandItem,
	LinkItem as CommandLinkItem,
	Input as CommandInput,
	List as CommandList,
	Separator as CommandSeparator,
	Shortcut as CommandShortcut,
	Loading as CommandLoading,
};
