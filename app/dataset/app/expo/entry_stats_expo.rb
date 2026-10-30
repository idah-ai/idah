# frozen_string_literal: true

class EntryStatsExpo < BaseExpo
  http_path "/entry_stats"

  use_service EntryStats::Service

  desc <<~MD
    Read-only access to per-entry computed statistics.
    Stats are recomputed:
      - when an entry transitions to submitted or errored
      - when the dataset's labeling_configuration is updated (e.g. categories renamed/deleted)
      - when an annotation is updated on an in-progress entry
  MD

  json_api EntryStat::Record do
    allowed_included "entry"
    show
    index do
      allowed_filters :entry_id__eq,
                      :entry_id__in,
                      :key__eq,
                      :key__in
    end
  end

  expose on_resource_event(Resource::Dataset::Entries, "submitted")
  def compute_stats_on_entry_submitted
    service.recompute(message.content[:resource_id])
  end

  expose on_resource_event(Resource::Dataset::Entries, "errored")
  def compute_stats_on_entry_errored
    service.recompute(message.content[:resource_id])
  end

  expose on_resource_event(Resource::Dataset::Datasets, "labeling_configuration_updated")
  def recompute_stats_on_labeling_config_updated
    changed_ids = message.content.dig(:metadata, :changed_category_ids) || []

    service.recompute_all_for_dataset(
      message.content[:resource_id],
      changed_category_ids: changed_ids
    )
  end

  %w[created updated].each do |event|
    expose on_resource_event(Resource::Dataset::Annotations, event)
    def compute_stats_on_annotation_changed
      args = message.content.dig(:args, 0) || {}
      return unless args.key?(:category) || args.key?(:deleted_at)

      # create doesn't add entry/dataset metadata, so fall back to the args
      entry_id = message.content.dig(:metadata, :entry_id) || args[:entry_id]
      dataset_id = message.content.dig(:metadata, :dataset_id) || args[:dataset_id]

      # if undo from deleted annotation, use the old category as the new category
      new_category = args[:category] || message.content.dig(:metadata, :old_category)

      service.recompute_from_annotation(entry_id:, dataset_id:, new_category:)
    end
  end
end
