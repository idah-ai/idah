<script lang="ts">
	import {
		AlertDialog,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
	} from "@/components/ui/alert-dialog";
	import type { ConfirmModalBaseProps } from "@/components/app/overlays/modals/confirm-modal.types";
	import Button from "@/components/ui/button/button.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

	// Props
	interface Props extends ConfirmModalBaseProps {
    	datasetRecord?: DatasetRecord;}
	let {
		title,
		description,
		open = $bindable(),
		modalTitle,
		modalDescription,
		children,
		confirm,
		confirmLabel = "Export",
		onCancel,
		onConfirm,
		datasetRecord,
	}: Props = $props();

  let dataset: DatasetRecord = $derived(
    datasetRecord
      ? datasetRecord
      : new DatasetRecord({
          type: "datasets:datasets",
          attributes: {
            name: null,
            description: null,
          },
        }),
  );
</script>

<AlertDialog bind:open>
	<AlertDialogContent>
		<AlertDialogHeader>
			{#if modalTitle}
				{@render modalTitle()}
			{:else}
				<AlertDialogTitle>{title}</AlertDialogTitle>
			{/if}
		</AlertDialogHeader>

		{#if modalDescription}
			{@render modalDescription()}
		{:else}
			<AlertDialogDescription>{description+datasetRecord?._jsonapiData.attributes.name}</AlertDialogDescription>
		{/if}

		{@render children?.()}

		<AlertDialogFooter>
			<AlertDialogCancel onclick={onCancel}>Cancel</AlertDialogCancel>

			{#if confirm}
				{@render confirm()}
			{:else}
				<Button variant="destructive" onclick={onConfirm}>{confirmLabel}</Button>
			{/if}
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
