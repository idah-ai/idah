import { Dialog as SheetPrimitive } from "bits-ui";
import Trigger from "./SheetTrigger.svelte";
import Close from "./SheetClose.svelte";
import Overlay from "./SheetOverlay.svelte";
import Content from "./SheetContent.svelte";
import Header from "./SheetHeader.svelte";
import Footer from "./SheetFooter.svelte";
import Title from "./SheetTitle.svelte";
import Description from "./SheetDescription.svelte";

const Root = SheetPrimitive.Root;
const Portal = SheetPrimitive.Portal;

export {
	Root,
	Close,
	Trigger,
	Portal,
	Overlay,
	Content,
	Header,
	Footer,
	Title,
	Description,
	//
	Root as Sheet,
	Close as SheetClose,
	Trigger as SheetTrigger,
	Portal as SheetPortal,
	Overlay as SheetOverlay,
	Content as SheetContent,
	Header as SheetHeader,
	Footer as SheetFooter,
	Title as SheetTitle,
	Description as SheetDescription,
};
