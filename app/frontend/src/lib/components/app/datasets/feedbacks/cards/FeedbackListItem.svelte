<script lang="ts">
  import { getContext } from "svelte";
  import { MessageSquareIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import * as Item from "@/components/ui/item/index";

  import { getFeedbackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IFeedbackItem } from "@/data/model/dataset/feedback-config-templates/record";

  interface Props {
    feedbackItemKey: string;
    feedbackItem: IFeedbackItem;
  }
  let { feedbackItemKey, feedbackItem }: Props = $props();

  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);

  const isTemplate = false;
  const alreadyInUsed = false; // TODO:: Implement note_feed.feedback_key_in_use

  const menus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          action: () => {
            controller.openFormModal(feedbackItemKey, feedbackItem);
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          disabled: isTemplate ? false : alreadyInUsed, // Can only deletable if feedback is not being used.
          destructive: true,
          action: async () => {
            await showConfirmModal({
              title: "Delete feedback item?",
              description: `This will permanently delete "${feedbackItem.label}". This action cannot be undone.`,
              confirmLabel: "Yes, Delete",
              onConfirm: () => {
                controller.deleteItem(feedbackItemKey);
              },
            });
          },
        },
      ],
    },
  };
</script>

<Item.Root
  class="border-b-border group hover:bg-primary/5 rounded-none py-2 transition-colors last:rounded-b-xl last:border-b-0"
>
  <Item.Media variant="icon" class="group-hover:bg-primary/10 group-hover:text-primary">
    <MessageSquareIcon class="shrink-0" />
  </Item.Media>

  <Item.Content>
    <Item.Title class="group-hover:text-primary">{feedbackItem.label}</Item.Title>
    <Item.Description class="text-xs">{feedbackItem.description}</Item.Description>
  </Item.Content>

  <Item.Actions>
    <DropdownMenus align="end" triggerSize="icon-sm" {menus}></DropdownMenus>
  </Item.Actions>
</Item.Root>
