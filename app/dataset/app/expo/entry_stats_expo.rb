# frozen_string_literal: true

class EntryStatsExpo < BaseExpo
  http_path "/entry_stats"

  use_service EntryStats::Service

  desc <<~MD
    Read-only access to per-entry computed statistics.
    Stats are recomputed:
      - when an entry transitions to submitted or errored
      - when the dataset's labeling_configuration is updated (e.g. categories renamed/deleted)
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

  expose on_resource_event(Resource::Dataset::Datasets, "updated")
  def recompute_stats_on_dataset_updated
    return unless message.content[:metadata][:labeling_configuration_updated]

    service.recompute_all_for_dataset(message.content[:resource_id])
  end
end
