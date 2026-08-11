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
    #   "shape.<type>.count"                → count of annotations per shape type, with the
    #                                         "<modality>:" prefix stripped (e.g.
    #                                         "idah-video:bounding-box" → "shape.bounding-box.count").
    #                                         Shape types from tool-type config keys are zero-filled
    #                                         (like categories). Generic across modalities, so it
    #                                         lives here rather than in a per-plugin generator.
    #
    # Category ids are collected by flattening values[*][:id] across all tool-type keys
    # in labeling_configuration (e.g. "idah-video:bounding-box" → :values → :id).
    # The category field is always `category` — no per-dataset override is supported.
    #
    # Note: Verse::Sequel::JsonEncoder deserialises JSON with symbolized keys.
    #
    # @param entry [Entry::Record] entry with dataset and annotations preloaded
    # @return [Hash{String => String}]
    def self.call(entry)
      config = entry.dataset.labeling_configuration || {}

      # Collect all configured category ids across all tool types (flat).
      configured_ids = config.each_value.flat_map do |tool_config|
        next [] unless tool_config.is_a?(Hash)

        Array(tool_config[:values]).filter_map { |v| v[:id] }
      end

      # Zero-fill all configured ids upfront
      label_counts = Hash.new(0)
      configured_ids.each { |id| label_counts[id] = 0 }

      # Shape type is "<modality>:<type>" in annotation.dimensions[:type]; strip the
      # modality prefix generically (everything up to the first ":") so the key reads
      # as "shape.bounding-box.count" regardless of which plugin produced the annotation.
      # Zero-fill configured shape types from the tool-type config keys (which are
      # "<modality>:<type>"), mirroring the category zero-fill so shapes with no
      # annotations still report 0.
      shape_counts = Hash.new(0)
      config.each_key do |key|
        key_s = key.to_s
        shape_counts[key_s.split(":", 2).last] = 0 if key_s.include?(":")
      end

      annotations = entry.annotations || []
      live_annotations = annotations.reject { |a| a.deleted_at }
      live_annotations.each do |annotation|
        category = annotation.category
        label_counts[category] += 1 if category

        type = annotation.shape_type
        shape_counts[type.split(":", 2).last] += 1 if type
      end

      stats = { "annotation.count" => live_annotations.size.to_s }

      label_counts.each do |label, count|
        stats["category.#{label}.count"] = count.to_s
      end

      shape_counts.each do |shape, count|
        stats["shape.#{shape}.count"] = count.to_s
      end

      stats
    end
  end
end
