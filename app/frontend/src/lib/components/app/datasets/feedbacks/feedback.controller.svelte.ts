import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";

import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
import {
  FeedbackConfigTemplateRecord,
  feedbackConfigTemplateDataSource,
} from "@/data/model/dataset/feedback-config-templates/record";
import { showActionFailedToast } from "@/utils/error/error.toasts";
import { showToast } from "@/components/ui/toast/index.svelte";

import type { FormModalAction } from "@/components/app/overlays/modals/form-modal.types";
import type { Hash } from "@/utils/types";
import type { IFeedbackConfig, IFeedbackItem } from "@/plugin/v2/types";

export const FEEDBACK_CONFIG_CONTROLLER_KEY = Symbol("feedback-config-controller");
export const FEEDBACK_CONFIG_TEMPLATE_CONTROLLER_KEY = Symbol("feedback-config-template-controller");

export function setFeedbackConfigController(key: symbol, controller: FeedBackConfigController) {
  setContext(key, controller);
}

export function getFeedbackConfigController(key: symbol): FeedBackConfigController {
  return getContext(key);
}

export class FeedBackConfigController {
  private savedSnapshot: string = $state("");
  public config = $state<SvelteMap<string, IFeedbackItem>>(new SvelteMap());
  public hasUnsavedChanges = $derived(JSON.stringify(Object.fromEntries(this.config.entries())) !== this.savedSnapshot);
  public configIsEmpty = $derived(this.config.size === 0);

  public formModalOpen: boolean = $state(false);
  public formModalAction: FormModalAction = $state("create");
  private updateKey = $state<string | undefined>(undefined);
  public isFormModalCreate: boolean = $derived(this.formModalAction === "create");
  public isFormModalUpdate: boolean = $derived(this.formModalAction === "update");
  public formModalData: IFeedbackItem = $state({
    label: "",
    description: null,
  });
  public formIsInvalid: boolean = $derived(!this.formModalData.label.trim());

  /** Pending States */
  public isUpdating: boolean = $state(false);

  constructor(snapshot: IFeedbackConfig) {
    this.setConfig(snapshot);
    this.setSavedSnapshot(this.config);
  }

  public getConfigHash() {
    return Object.fromEntries(this.config.entries());
  }

  public setConfig(newConfig: IFeedbackConfig) {
    this.config = new SvelteMap(Object.entries(newConfig));
  }

  setSavedSnapshot(configMap: SvelteMap<string, IFeedbackItem>) {
    this.savedSnapshot = JSON.stringify(Object.fromEntries(configMap));
  }

  markCurrentAsSaved() {
    this.savedSnapshot = JSON.stringify(Object.fromEntries(this.config.entries()));
  }

  public async loadKeysInUse(datasetId: string) {
    return await datasetsBackendDataSource.feedbackKeysInUse(datasetId);
  }

  public async updateConfiguration(datasetId: string): Promise<IFeedbackConfig | undefined> {
    this.isUpdating = true;

    try {
      const updated = await datasetsBackendDataSource.updateFeedbackConfiguration({
        id: datasetId,
        feedbackConfiguration: this.getConfigHash(),
      });

      this.setConfig(updated.data);
      this.setSavedSnapshot(this.config);

      return updated.data;
    } catch (err) {
      showActionFailedToast(err);
      return undefined;
    } finally {
      this.isUpdating = false;
    }
  }

  public apply(config: IFeedbackConfig) {
    this.setConfig(config);
  }

  public upsertItem() {
    const key = this.updateKey ?? Date.now().toString();

    this.config.set(key, {
      label: this.formModalData.label,
      description: this.formModalData.description,
    });
  }

  public async deleteItem(key: string) {
    this.config.delete(key);
  }

  public resetFormModalData() {
    this.formModalData = {
      label: "",
      description: null,
    };
    this.updateKey = undefined;
  }

  openFormModal(key?: string, updateFeedbackItem?: IFeedbackItem) {
    if (updateFeedbackItem) {
      this.updateKey = key;
      this.formModalAction = "update";
      this.formModalData = { ...updateFeedbackItem };
    } else {
      this.formModalAction = "create";
      this.resetFormModalData();
    }

    this.formModalOpen = true;
  }

  closeFormModal() {
    this.formModalOpen = false;
    this.resetFormModalData();
  }
}

class FeedbackConfigTemplateController {
  /** Current feedback template selection */
  public selection = $state<FeedbackConfigTemplateRecord | null>(null);
  public isSelected = $derived(this.selection !== null);
  public isNotSelected = $derived(this.selection === null);

  /** Overlays */
  public sheetOpen = $state<boolean>(false);
  public formModalOpen = $state<boolean>(false);

  public templates = $state<FeedbackConfigTemplateRecord[]>([]);
  public template = $derived({
    isEmpty: this.templates.length === 0,
    isNotEmpty: this.templates.length !== 0,
  });

  public isLoading = $state<boolean>(false);
  public isCreating = $state<boolean>(false);
  public isUpdating = $state<boolean>(false);
  public isDeleting = $state<boolean>(false);
  public isPending = $derived<boolean>(this.isUpdating || this.isDeleting);

  public async loadTemplates() {
    this.isLoading = true;
    try {
      const res = await feedbackConfigTemplateDataSource.list();

      this.templates = res.data;
    } catch (err) {
      showActionFailedToast(err);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  public unSelectTemplate() {
    this.selection = null;
  }

  public openSheet() {
    this.sheetOpen = true;
  }

  public closeSheet() {
    this.sheetOpen = false;
  }

  public openFormModal() {
    this.formModalOpen = true;
  }

  public closeFormModal() {
    this.formModalOpen = false;
  }

  public async selectTemplate(id: string | number | null) {
    if (!id) return;

    this.isLoading = true;

    try {
      const res = await feedbackConfigTemplateDataSource.get(String(id));
      this.selection = res.data;
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoading = false;
    }
  }

  public async create(params: { name: string; modality: string; organizationId: number; config: Hash }) {
    this.isCreating = true;

    try {
      const { name, modality, organizationId, config } = params;

      await feedbackConfigTemplateDataSource.create({
        attributes: {
          name,
          feedback_configuration: config,
          modality,
          organization_id: String(organizationId),
        },
      });

      /** Load templates again once created to display on dropdown menus */
      await this.loadTemplates();

      showToast.success({
        title: "Template created",
        description: `The template "${name}" has been created.`,
      });

      this.closeFormModal();
    } catch (err) {
      showActionFailedToast(err);
    } finally {
      this.isCreating = false;
    }
  }

  public async replace(params: { templateId: string; config: Hash }) {
    this.isUpdating = true;
    try {
      const { templateId, config } = params;

      const res = await feedbackConfigTemplateDataSource.update(
        templateId,
        { attributes: { feedback_configuration: config } },
        { showErrorToast: false },
      );

      const updated = res.data;

      if (this.selection?.id === updated.id) {
        this.selection = updated;
      }

      showToast.success({
        title: "Template overwritten",
        description: `The template "${updated.name}" has been updated.`,
      });
    } catch (err) {
      showActionFailedToast(err);
    } finally {
      this.isUpdating = false;
    }
  }

  public async rename(newName: string) {
    if (this.isNotSelected) return;

    this.isUpdating = true;
    try {
      const res = await feedbackConfigTemplateDataSource.update(this.selection!.id, {
        attributes: {
          name: newName,
        },
      });

      const updated = res.data;

      this.selection = updated;

      showToast.success({
        title: "Template renamed",
        description: `The template have been renamed to "${newName}"`,
      });
    } catch (err) {
      showActionFailedToast(err);
    } finally {
      this.isUpdating = false;
    }
  }

  public async save(params: { newConfig: IFeedbackConfig }) {
    if (this.isNotSelected) return;

    this.isUpdating = true;

    try {
      const { newConfig } = params;
      const res = await feedbackConfigTemplateDataSource.update(this.selection!.id, {
        attributes: {
          feedback_configuration: newConfig,
        },
      });

      const updated = res.data;

      showToast.success({
        title: "Template saved",
        description: `The template "${updated.name}" has been saved.`,
      });
    } catch (err) {
      showActionFailedToast(err);
    } finally {
      this.isUpdating = false;
    }
  }

  public async delete() {
    if (this.isNotSelected) return;

    this.isDeleting = true;

    try {
      await feedbackConfigTemplateDataSource.delete(this.selection!.id);

      showToast.success({
        title: "Template deleted",
        description: `The template "${this.selection?.name}" has been deleted.`,
      });

      this.unSelectTemplate();
    } catch (err) {
      showActionFailedToast(err);
    } finally {
      this.isDeleting = false;
    }
  }
}

export const feedbackConfigTemplate = new FeedbackConfigTemplateController();
