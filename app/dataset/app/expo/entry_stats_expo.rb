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

  expose on_resource_event(Resource::Dataset::Annotations, "updated")
  def compute_stats_on_annotation_updated
    args = message.content.dig(:args, 0) || {}
    # binding.pry
    return unless args.key?(:category) || args.key?(:deleted_at)

    entry_id = message.content.dig(:metadata, :entry_id) || args[:entry_id]

    service.recompute_from_annotation(entry_id)
  end
end
