import { Popover as PopoverPrimitive } from "bits-ui";
import Content from "./PopoverContent.svelte";
import Trigger from "./PopoverTrigger.svelte";
const Root = PopoverPrimitive.Root;
const Close = PopoverPrimitive.Close;

export {
	Root,
	Content,
	Trigger,
	Close,
	//
	Root as Popover,
	Content as PopoverContent,
	Trigger as PopoverTrigger,
	Close as PopoverClose,
};
