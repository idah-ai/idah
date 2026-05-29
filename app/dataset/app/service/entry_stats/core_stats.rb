# frozen_string_literal: true

module EntryStats
  module CoreStats
    # Returns a flat hash of stat key → string value for the given entry.
    #
    # Keys produced:
    #   "annotation.count"                  → total annotation count
    #   "category.<id>.count"    → one key per distinct category id;
    #                                         configured category ids (from all tool types
    #                                         in labeling_configuration) are zero-filled,
    #                                         data-driven ids not in config are also emitted
    #                                         with their real count (never silently dropped)
    #
    # Category ids are collected by flattening values[*][:id] across all tool-type keys
    # in labeling_configuration (e.g. "idah-video:bounding-box" → :values → :id).
    # The category field read from each annotation defaults to :category and can be
    # overridden via labeling_configuration[:category_field].
    #
    # Note: Verse::Sequel::JsonEncoder deserialises JSON with symbolized keys.
    #
    # @param entry [Entry::Record] entry with dataset and annotations preloaded
    # @return [Hash{String => String}]
    def self.call(entry)
      config = entry.dataset.labeling_configuration || {}

      category_field = config[:category_field] || :category

      # Collect all configured category ids across all tool types (flat).
      # Values of labeling_configuration are tool configs (Hashes); skip anything else
      # (e.g. the :category_field scalar override).
      configured_ids = config.each_value.flat_map do |tool_config|
        next [] unless tool_config.is_a?(Hash)

        Array(tool_config[:values]).filter_map { |v| v[:id] }
      end

      # Zero-fill all configured ids upfront
      label_counts = Hash.new(0)
      configured_ids.each { |id| label_counts[id] = 0 }

      annotations = entry.annotations || []
      annotations.each do |annotation|
        category = annotation.annotation&.dig(category_field)
        next unless category

        label_counts[category] += 1
      end

      stats = { "annotation.count" => annotations.size.to_s }

      label_counts.each do |label, count|
        stats["category.#{label}.count"] = count.to_s
      end

      stats
    end
  end
end
