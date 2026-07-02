<script lang="ts">
  import { ArrowDownIcon, SaveIcon, Trash2Icon } from "@lucide/svelte";

  import * as Dialog from "$lib/components/ui/dialog";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { labellingConfigurationTemplateDataSource } from "@/data/model/dataset/labelling-configuration-template/record";

  import type { Resource } from "@/security/types";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";

  interface Props {
    open: boolean;
  }
  let { open = $bindable() }: Props = $props();

  const resource: Resource = "dataset:labeling_configuration_templates";
  let selectedTemplateId = $state<string | null>(null);
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[90vh] max-w-[95vw] min-w-[95vw]">
    <Dialog.Header>
      <Dialog.Title>Select Template</Dialog.Title>
    </Dialog.Header>

    <section class="flex">
      <div>
        <SingleSelectDatasourceField
          name="{resource}.name"
          class="min-w-64"
          displayKey="name"
          searchKeyWithOperation="name__match"
          placeholder="Select template"
          valueKey="id"
          dataSource={labellingConfigurationTemplateDataSource}
          value={selectedTemplateId}
        />
      </div>

      <div class="ml-auto flex items-center gap-4">
        <Button variant="destructive-outline">
          <Trash2Icon />
          Delete
        </Button>

        <Button variant="outline">
          <SaveIcon />
          Save Changes
        </Button>

        <Button>
          <ArrowDownIcon />
          Apply This Template
        </Button>
      </div>
    </section>

    <section>
      <ResponseBlock
        title="No Template Yet"
        description="There is no labelling configuration template yet at the moment"
      />
      <!-- LABEL CONFIG -->
    </section>
  </Dialog.Content>
</Dialog.Root>
