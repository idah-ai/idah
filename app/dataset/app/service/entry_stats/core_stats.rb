# frozen_string_literal: true

module EntryStats
  module CoreStats
    # Returns a flat hash of stat key → string value for the given entry.
    #
    # Keys produced:
    #   "annotation.count"                  → total annotation count
    #   "shape.<type>.count"                → count of annotations per shape type, with the
    #                                         "<modality>:" prefix stripped (e.g.
    #                                         "idah-video:bounding-box" → "shape.bounding-box.count").
    #                                         Shape types from tool-type config keys are zero-filled.
    #                                         Generic across modalities, so it
    #                                         lives here rather than in a per-plugin generator.
    #   "orphan_category.count"             → count of annotations whose category is not
    #                                         present in labeling_configuration (e.g. was
    #                                         deleted or renamed). Each annotation counted
    #                                         individually.
    #
    # Note: Verse::Sequel::JsonEncoder deserialises JSON with symbolized keys.
    #
    # @param entry [Entry::Record] entry with dataset and annotations preloaded
    # @return [Hash{String => String}]
    def self.call(entry)
      config = entry.dataset.labeling_configuration || {}
      # Collect all configured category ids across all tool types (flat).
      configured_ids = entry.dataset.configured_category_ids

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
      live_annotations = annotations.reject(&:deleted_at)
      live_annotations.each do |annotation|
        type = annotation.shape_type
        shape_counts[type.split(":", 2).last] += 1 if type
      end

      stats = { "annotation.count" => live_annotations.size.to_s }

      # Count annotations whose category is not present in the labeling configuration.
      # These are "orphan" annotations — the category was deleted, renamed, or never
      # configured. Each annotation is counted individually (not per distinct category).
      configured_set = configured_ids.to_set
      orphan_annotation_count = live_annotations.count do |annotation|
        category = annotation.category
        category && !configured_set.include?(category)
      end
      stats["orphan_category.count"] = orphan_annotation_count.to_s

      shape_counts.each do |shape, count|
        stats["shape.#{shape}.count"] = count.to_s
      end

      stats
    end
  end
end
